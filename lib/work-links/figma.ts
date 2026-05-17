// Figma REST API client for public files.
//
// Why this exists: the generic HTML extractor sees ~nothing on a Figma
// page — the canvas is rendered client-side from data fetched after JS
// boot. We need to bypass the page and go straight to api.figma.com,
// which returns the full document tree (page names, frame names, text
// layers, components) as JSON.
//
// Auth: a single service-side Personal Access Token (FIGMA_ACCESS_TOKEN
// env var). A PAT can read any file its owner has access to — and
// "Anyone with the link can view" files are accessible to every
// authenticated Figma account, so one token on the server unlocks all
// public files for our users. The file's owner doesn't have to invite
// us or do OAuth.
//
// Setup (one-time): go to figma.com → Account Settings → Personal
// Access Tokens → "Create new token" → copy → add to .env.local as
// FIGMA_ACCESS_TOKEN=...

const FIGMA_API_BASE = "https://api.figma.com/v1";

// Figma per-token rate limits clear in roughly a minute. We don't
// retry forever (request deadline is 30s), but one moderate wait + a
// retry covers the case where a burst of activity hit the cap and is
// already cooling down. If we still get 429 after that, surface the
// rate_limited reason and tell the user to wait.
const RETRY_MAX_ATTEMPTS = 2;
const RETRY_BACKOFF_MS = 8_000;
const RETRY_TIMEOUT_BUDGET_MS = 20_000;

export async function fetchWithRetryOn429(
  url: string,
  init: RequestInit,
): Promise<Response> {
  let attempt = 0;
  let res: Response;
  while (true) {
    res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status !== 429 || attempt >= RETRY_MAX_ATTEMPTS - 1) return res;
    // Use server-provided Retry-After if reasonable; otherwise the
    // local default. Always clamp to our budget so we don't blow
    // the route deadline.
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "", 10);
    const waitMs = Math.min(
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : RETRY_BACKOFF_MS,
      RETRY_TIMEOUT_BUDGET_MS,
    );
    await new Promise((r) => setTimeout(r, waitMs));
    attempt++;
  }
}
// `depth=3` is the sweet spot: enough to get pages → frames →
// sub-frames (where named groups / components usually live) without
// pulling megabytes of geometry for huge files. Deeper traversal
// would get text-layer content too — Phase 2 if names alone fall short.
const FIGMA_DEPTH = 3;
const FETCH_TIMEOUT_MS = 15_000;
// Hard caps to keep the text we send to Gemini sensible. A design
// system file can have thousands of components / frames; we sample.
const MAX_FRAMES_PER_PAGE = 25;
const MAX_PAGES = 12;
const MAX_COMPONENTS = 40;
const MAX_TEXT_CHARS = 4000;

export interface FigmaExtraction {
  ok: true;
  fileName: string;
  thumbnailUrl: string | null;
  /** Synthetic text doc the AI summariser can read. */
  text: string;
  /** File key — needed for follow-up /v1/images render calls. */
  fileKey: string;
  /**
   * Top frame node IDs across pages — biggest visible canvases first.
   * The Vision enrichment renders these as PNGs and hands them to
   * Gemini multimodal. Capped to keep render time + token cost sane.
   */
  topFrameIds: string[];
}

export interface FigmaExtractionError {
  ok: false;
  reason:
    | "no_token"
    | "invalid_url"
    | "private"
    | "not_found"
    | "rate_limited"
    | "fetch_failed";
  /**
   * On 429: seconds Figma told us to wait before this file becomes
   * accessible again. The free Starter tier returns very large values
   * (multiple days). Passed up so the user-facing error can name a
   * concrete date instead of "try again in a minute".
   */
  retryAfterSeconds?: number;
}

export type FigmaResult = FigmaExtraction | FigmaExtractionError;

// Loose Figma API types — we only touch the fields we need.
interface FigmaFill {
  type?: string;
  imageRef?: string;
  visible?: boolean;
}
interface FigmaNode {
  id: string;
  name?: string;
  type?: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: { width?: number; height?: number };
  /** Set on TEXT nodes — the actual text the user typed on the canvas. */
  characters?: string;
  /** Set on nodes that have paint fills (frames, rectangles, vectors). */
  fills?: FigmaFill[];
}

interface FigmaComponent {
  name?: string;
  description?: string;
}

interface FigmaFileResponse {
  name?: string;
  lastModified?: string;
  thumbnailUrl?: string;
  document?: FigmaNode;
  components?: Record<string, FigmaComponent>;
  componentSets?: Record<string, FigmaComponent>;
  /** Top-level styles map (colors, text, effects, grids). */
  styles?: Record<string, unknown>;
}

/**
 * Parse the file key out of any Figma URL variant we might encounter:
 *   - figma.com/file/{key}/{name}         (legacy)
 *   - figma.com/design/{key}/{name}       (current)
 *   - figma.com/proto/{key}/{name}        (prototype URL — same file)
 *   - figma.com/community/file/{key}/{name}
 * Returns null if the URL isn't a Figma file URL or the key looks malformed.
 */
export function parseFigmaFileKey(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)figma\.com$/i.test(parsed.hostname)) return null;
  const segments = parsed.pathname.split("/").filter(Boolean);
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i].toLowerCase();
    if (s === "file" || s === "design" || s === "proto") {
      const key = segments[i + 1];
      if (key && /^[A-Za-z0-9]{16,}$/.test(key)) return key;
    }
  }
  return null;
}

/**
 * Best-effort deep extraction of a Figma file's content via the API.
 *
 * Used as an *augmentation* on top of the always-on public-HTML
 * scrape (figma-public.ts). The public scrape always succeeds and
 * gives us the thumbnail + file name; this function adds:
 *   • page names
 *   • named frames per page
 *   • every TEXT layer's actual content (button labels, headings,
 *     body copy on the canvas)
 *
 * Why this matters: a sparse thumbnail (the worst-case for Vision)
 * can still produce a rich summary when we feed Gemini the literal
 * text the designer wrote on the canvas. "Welcome to V Stars",
 * "Subscribe", "Profile" — that's all in the document tree.
 *
 * Cost: ONE /v1/files call. Counts against the per-file quota, but
 * the next add/refresh on the same file won't hit the API again
 * because we cache the extracted content in the DB.
 *
 * Returns null on any failure (no token, rate-limited, malformed
 * response) so callers can degrade gracefully to thumbnail-only.
 */
export interface FigmaApiContent {
  fileKey: string;
  fileName: string;
  lastModified: string | null;
  pages: string[];
  frames: Array<{ page: string; name: string }>;
  /** All text-layer content concatenated (best-effort, deduped). */
  textLayers: string[];
  /** Frame node IDs ready for /v1/images render — kept for future
   *  "deep refresh" workflow; unused by the default add path. */
  topFrameIds: string[];
  /** Structural counts used by the quality bar. */
  signals: {
    pageCount: number;
    frameCount: number;
    namedFrameCount: number;
    componentCount: number;
    styleCount: number;
    textLayerCount: number;
    meaningfulTextCount: number;
    imageFillCount: number;
  };
}

export async function extractFigmaApiContent(
  url: string,
): Promise<FigmaApiContent | null> {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) return null;
  const fileKey = parseFigmaFileKey(url);
  if (!fileKey) return null;

  let res: Response;
  try {
    // Higher depth than the old extractor (3) so the walk reaches
    // text layers — most canvas text lives inside frames-inside-
    // frames. depth=8 is generous; deeper-than-that nesting is rare
    // outside design-system files.
    res = await fetchWithRetryOn429(
      `${FIGMA_API_BASE}/files/${fileKey}?depth=8`,
      { headers: { "X-Figma-Token": token, accept: "application/json" } },
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as FigmaFileResponse | null;
  if (!data?.document) return null;
  return walkFigmaContent(fileKey, data);
}

// Limits keep the prompt budget sane on files with thousands of text
// layers (design systems, large UI kits).
const MAX_TEXT_LAYERS = 200;
const MAX_TOTAL_TEXT_CHARS = 6_000;

// Words Figma uses as auto-generated names + common template tokens
// that don't actually identify what's on the canvas. Frames whose
// names contain ONLY these (plus enumerators / dimensions) don't
// count as "meaningfully named". Catches the cases the old regex
// missed: "Desktop - 3", "Page 4", "iPhone 14 - 5", pure numbers
// like "01" or "1.2.3", and dimensions like "1920x1080".
const PLACEHOLDER_WORDS = new Set([
  "frame", "group", "rectangle", "slice", "vector", "ellipse",
  "star", "line", "polygon", "component", "instance", "section",
  "page", "slide", "screen", "artboard", "canvas",
  "desktop", "mobile", "tablet", "iphone", "ipad", "android",
  "pixel", "web", "laptop", "macbook", "watch",
  "untitled", "document", "sketch", "prototype", "design",
  "copy", "duplicate",
]);

/**
 * True when a frame name carries no semantic content — it's just
 * Figma's auto-generated default, a template/device label, a number,
 * a dimension, or some combination of those. Names like "Onboarding"
 * or "Daily List" or "Hero 1" pass through (have at least one real
 * word). Names like "Frame 87", "Desktop - 3", "Page 4", "01",
 * "1920x1080", "iPhone 14 - 5" all fail.
 *
 * Heuristic: tokenize the name into letter sequences (3+ letters);
 * if none of those tokens fall outside the placeholder vocabulary,
 * the name is generic.
 */
export function isPlaceholderFrameName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  // Letter-only tokens. Pure numbers and dimensions yield no tokens
  // → automatically generic.
  const tokens = trimmed.toLowerCase().match(/[a-z]+/g) ?? [];
  for (const tok of tokens) {
    if (tok.length >= 3 && !PLACEHOLDER_WORDS.has(tok)) {
      // Found at least one substantive word → not generic.
      return false;
    }
  }
  return true;
}

// Per-page frame budget used when picking representative screens for
// Vision rendering. We want coverage of the WHOLE file, not three
// screens from the landing page — so we cap how many frames any single
// page can contribute. Tuned against `MAX_VISION_FRAMES_TOTAL` so a
// 1-page file still gets up to 3 frames (depth) while a 6-page file
// gets one frame per page.
const MAX_VISION_FRAMES_TOTAL = 6;
const MAX_VISION_FRAMES_PER_PAGE = 3;
// Renderable-frame size band — same numbers the legacy picker used.
// Outside this range Figma either rejects the render (too big →
// "Render timeout") or returns something Vision can't read (too small).
const MIN_RENDERABLE_AREA = 80_000;
const MAX_RENDERABLE_AREA = 8_500_000;

interface CandidateFrame {
  id: string;
  page: string;
  area: number;
}

function walkFigmaContent(
  fileKey: string,
  data: FigmaFileResponse,
): FigmaApiContent {
  const pages: string[] = [];
  const frames: Array<{ page: string; name: string }> = [];
  const seenText = new Set<string>();
  const textLayers: string[] = [];
  let textCharsUsed = 0;
  // Collect every renderable named frame across all pages first; pick
  // the page-balanced subset for Vision in a second pass below. Doing
  // it inline (as the old code did) biased the picks toward the first
  // page that happened to contain a few named screens, which meant
  // multi-page files only ever showed Gemini their landing page.
  const candidates: CandidateFrame[] = [];

  // Structural counts that go into the quality bar.
  let pageCount = 0;
  let frameCount = 0;
  let namedFrameCount = 0;
  let textLayerCount = 0;
  let meaningfulTextCount = 0;
  let imageFillCount = 0;

  const isGenericName = isPlaceholderFrameName;

  const visit = (node: FigmaNode, pageName: string | null) => {
    if (node.type === "CANVAS") {
      const name = (node.name ?? "").trim() || "Untitled page";
      pages.push(name);
      pageCount++;
      pageName = name;
    } else if (
      node.type === "FRAME" ||
      node.type === "COMPONENT" ||
      node.type === "COMPONENT_SET" ||
      node.type === "SECTION"
    ) {
      frameCount++;
      const name = (node.name ?? "").trim();
      if (name && !isGenericName(name) && pageName) {
        namedFrameCount++;
        frames.push({ page: pageName, name });
        const bb = node.absoluteBoundingBox;
        const area = (bb?.width ?? 0) * (bb?.height ?? 0);
        if (area >= MIN_RENDERABLE_AREA && area <= MAX_RENDERABLE_AREA) {
          candidates.push({ id: node.id, page: pageName, area });
        }
      }
    } else if (node.type === "TEXT") {
      textLayerCount++;
      const chars = (node.characters ?? "").trim();
      // "Meaningful" means it looks like real content, not a number,
      // single letter, or page-number placeholder. Two heuristics:
      // length >= 3 AND (contains whitespace OR is at least 8 chars).
      if (chars.length >= 3 && (/\s/.test(chars) || chars.length >= 8)) {
        meaningfulTextCount++;
      }
      if (
        chars.length > 1 &&
        textLayers.length < MAX_TEXT_LAYERS &&
        textCharsUsed + chars.length <= MAX_TOTAL_TEXT_CHARS &&
        !seenText.has(chars)
      ) {
        seenText.add(chars);
        textLayers.push(chars);
        textCharsUsed += chars.length;
      }
    }
    // Image fills indicate real imagery (photos, illustrations,
    // screenshots) sitting on the canvas — a strong signal of visual
    // content vs an empty wireframe.
    if (Array.isArray(node.fills)) {
      for (const f of node.fills) {
        if (f.type === "IMAGE" && f.visible !== false) imageFillCount++;
      }
    }
    for (const child of node.children ?? []) visit(child, pageName);
  };

  if (data.document) visit(data.document, null);

  const componentCount =
    Object.keys(data.components ?? {}).length +
    Object.keys(data.componentSets ?? {}).length;
  const styleCount = Object.keys(data.styles ?? {}).length;

  const topFrameIds = pickPageBalancedFrames(candidates);

  return {
    fileKey,
    fileName: data.name ?? "Untitled Figma file",
    lastModified: data.lastModified ?? null,
    pages,
    frames,
    textLayers,
    topFrameIds,
    signals: {
      pageCount,
      frameCount,
      namedFrameCount,
      componentCount,
      styleCount,
      textLayerCount,
      meaningfulTextCount,
      imageFillCount,
    },
  };
}

/**
 * Choose a page-balanced subset of renderable frames for Vision.
 *
 * Strategy: rank candidates per page by "screen-shaped-ness" (distance
 * from a typical screen area, ~1 Mpx²), then round-robin across pages
 * up to per-page and total caps. This guarantees a multi-page file
 * shows Gemini frames from multiple pages rather than three siblings
 * from the first page that happened to have named frames.
 */
function pickPageBalancedFrames(candidates: CandidateFrame[]): string[] {
  if (candidates.length === 0) return [];
  const byPage = new Map<string, CandidateFrame[]>();
  for (const c of candidates) {
    const arr = byPage.get(c.page) ?? [];
    arr.push(c);
    byPage.set(c.page, arr);
  }
  // Rank inside each page by closeness to a typical screen.
  const logTarget = Math.log(1_000_000);
  for (const arr of byPage.values()) {
    arr.sort(
      (a, b) =>
        Math.abs(Math.log(a.area) - logTarget) -
        Math.abs(Math.log(b.area) - logTarget),
    );
  }
  const pageQueues = [...byPage.values()];
  const picked: string[] = [];
  const perPageTaken = new Map<string, number>();
  // Round-robin across pages until we hit either the total cap or every
  // page is exhausted / capped at MAX_VISION_FRAMES_PER_PAGE.
  while (picked.length < MAX_VISION_FRAMES_TOTAL) {
    let progressed = false;
    for (const queue of pageQueues) {
      if (queue.length === 0) continue;
      const taken = perPageTaken.get(queue[0].page) ?? 0;
      if (taken >= MAX_VISION_FRAMES_PER_PAGE) continue;
      const next = queue.shift()!;
      picked.push(next.id);
      perPageTaken.set(next.page, taken + 1);
      progressed = true;
      if (picked.length >= MAX_VISION_FRAMES_TOTAL) break;
    }
    if (!progressed) break;
  }
  return picked;
}

/** Render the extracted content as a single Vision-prompt-ready string. */
export function renderFigmaApiContentAsText(c: FigmaApiContent): string {
  const lines: string[] = [];
  lines.push(`Figma file: ${c.fileName}`);
  if (c.lastModified) lines.push(`Last modified: ${c.lastModified.slice(0, 10)}`);
  if (c.pages.length > 0) {
    lines.push("");
    lines.push(`Pages (${c.pages.length}): ${c.pages.slice(0, 12).join(", ")}`);
  }
  if (c.frames.length > 0) {
    lines.push("");
    lines.push("Named frames / screens:");
    // Group by page for readability.
    const byPage: Record<string, string[]> = {};
    for (const f of c.frames) {
      (byPage[f.page] ??= []).push(f.name);
    }
    for (const [page, names] of Object.entries(byPage)) {
      lines.push(`  ${page}: ${names.slice(0, 25).join(", ")}`);
    }
  }
  if (c.textLayers.length > 0) {
    lines.push("");
    lines.push(`Text content on the canvas (${c.textLayers.length} layers):`);
    for (const t of c.textLayers) {
      lines.push(`  • ${t.replace(/\s+/g, " ").slice(0, 240)}`);
    }
  }
  return lines.join("\n");
}

export async function extractFigmaFile(url: string): Promise<FigmaResult> {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) return { ok: false, reason: "no_token" };

  const key = parseFigmaFileKey(url);
  if (!key) return { ok: false, reason: "invalid_url" };

  let res: Response;
  try {
    res = await fetchWithRetryOn429(
      `${FIGMA_API_BASE}/files/${key}?depth=${FIGMA_DEPTH}`,
      { headers: { "X-Figma-Token": token, accept: "application/json" } },
    );
  } catch (err) {
    console.error("[figma] network error", err);
    return { ok: false, reason: "fetch_failed" };
  }

  if (res.status === 401 || res.status === 403 || res.status === 404) {
    // Figma returns 404 for both "no such file" and "you don't have
    // access" — without further info we can't disambiguate. The
    // user-facing copy treats both as "file is private or wrong link".
    return { ok: false, reason: res.status === 404 ? "not_found" : "private" };
  }
  if (res.status === 429) {
    const retryHeader = parseInt(res.headers.get("retry-after") ?? "", 10);
    return {
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: Number.isFinite(retryHeader) && retryHeader > 0
        ? retryHeader
        : undefined,
    };
  }
  if (!res.ok) {
    console.error("[figma] non-ok response", { status: res.status });
    return { ok: false, reason: "fetch_failed" };
  }

  const data = (await res.json().catch(() => null)) as FigmaFileResponse | null;
  if (!data) return { ok: false, reason: "fetch_failed" };

  return {
    ok: true,
    fileName: data.name ?? "Untitled Figma file",
    thumbnailUrl: data.thumbnailUrl ?? null,
    text: buildTextSummary(data),
    fileKey: key,
    topFrameIds: pickTopFrameIds(data),
  };
}

/**
 * Pick the most representative frames across pages for vision rendering.
 *
 * Strategy is *not* "biggest area first" — that picks giant canvases
 * (background sheets, sprawling infinite-canvas dumps) that Figma's
 * renderer rejects with "Render timeout, try requesting fewer or
 * smaller images". Instead we filter to a realistic frame-size band
 * (rough match for mobile / desktop screen mockups and component
 * sheets) and rank smaller-but-still-meaningful frames first so the
 * call succeeds.
 */
// Conservative: Figma's free Starter plan locks a file for DAYS once
// its per-file API quota is exceeded. Two renders per add is the
// minimum that lets Gemini Vision describe both an overview screen
// and a representative detail screen. The lower we keep this, the
// more headroom users have for re-checks before they hit the cap.
const MAX_VISION_FRAMES = 2;
const FRAMES_PER_PAGE = 1;
// Reasonable area band for renderable frames. Tuned to cover:
//  - mobile screens (390×844 ≈ 330k)
//  - tablet screens (834×1194 ≈ 1M)
//  - desktop screens (1440×900 ≈ 1.3M, 1920×1080 ≈ 2M)
//  - tall web mockups (1920×4000 ≈ 7.7M)
// Anything bigger is almost always a background sheet or marketing
// canvas — Figma can't render those in our timeout budget.
const MIN_FRAME_AREA = 80_000; // 320×250 — tiny but still legible
const MAX_FRAME_AREA = 8_500_000;

function pickTopFrameIds(data: FigmaFileResponse): string[] {
  const doc = data.document;
  if (!doc?.children) return [];
  const picked: string[] = [];
  for (const page of doc.children) {
    if (!page.children) continue;
    const candidates = page.children
      .filter(
        (c) =>
          c.type === "FRAME" ||
          c.type === "COMPONENT_SET" ||
          c.type === "SECTION",
      )
      .map((c) => ({
        id: c.id,
        area:
          (c.absoluteBoundingBox?.width ?? 0) *
          (c.absoluteBoundingBox?.height ?? 0),
      }))
      // Keep only frames inside the renderable size band.
      .filter((c) => c.area >= MIN_FRAME_AREA && c.area <= MAX_FRAME_AREA)
      // Prefer mid-sized frames (closer to a typical screen) over the
      // band edges. We approximate "typical screen" as 1M px²
      // (1024×1024) and rank by distance from that target.
      .map((c) => ({ ...c, score: Math.abs(Math.log(c.area) - Math.log(1_000_000)) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, FRAMES_PER_PAGE);
    for (const c of candidates) {
      if (picked.length >= MAX_VISION_FRAMES) return picked;
      picked.push(c.id);
    }
  }
  return picked;
}

/**
 * Build a plain-text summary of the file structure that fits within the
 * AI summary prompt's context budget. We name-drop pages, frames, and
 * components — the parts that carry the most semantic signal about
 * what was designed.
 */
function buildTextSummary(data: FigmaFileResponse): string {
  const lines: string[] = [];
  if (data.name) lines.push(`Figma file: ${data.name}`);
  if (data.lastModified) {
    const d = new Date(data.lastModified);
    if (!Number.isNaN(d.getTime())) {
      lines.push(`Last modified: ${d.toISOString().slice(0, 10)}`);
    }
  }

  const doc = data.document;
  if (doc?.children) {
    const pages = doc.children.slice(0, MAX_PAGES);
    if (pages.length > 0) {
      lines.push("");
      lines.push(
        `Pages (${doc.children.length}): ${pages.map((p) => p.name ?? "(unnamed)").join(", ")}`,
      );
      lines.push("");
      lines.push("Screens / frames:");
      for (const page of pages) {
        const frames = collectNamedFrames(page).slice(0, MAX_FRAMES_PER_PAGE);
        if (frames.length === 0) continue;
        lines.push(`  ${page.name ?? "(unnamed page)"}:`);
        for (const f of frames) {
          lines.push(`    - ${f}`);
        }
      }
    }
  }

  const components = collectComponentNames(data);
  if (components.length > 0) {
    lines.push("");
    lines.push(
      `Components / variants: ${components.slice(0, MAX_COMPONENTS).join(", ")}`,
    );
  }

  let text = lines.join("\n");
  if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS);
  return text;
}

function collectNamedFrames(page: FigmaNode): string[] {
  const out: string[] = [];
  if (!page.children) return out;
  for (const child of page.children) {
    if (
      child.type === "FRAME" ||
      child.type === "COMPONENT" ||
      child.type === "COMPONENT_SET" ||
      child.type === "SECTION"
    ) {
      const name = (child.name ?? "").trim();
      // Skip Figma's default placeholder names — they're noise.
      if (name && !/^(Frame|Group|Rectangle|Slice)\s*\d*$/.test(name)) {
        out.push(name);
      }
    }
  }
  return out;
}

function collectComponentNames(data: FigmaFileResponse): string[] {
  const names = new Set<string>();
  const fromMap = (m: Record<string, FigmaComponent> | undefined) => {
    if (!m) return;
    for (const v of Object.values(m)) {
      const name = (v.name ?? "").trim();
      if (name) names.add(name);
    }
  };
  fromMap(data.components);
  fromMap(data.componentSets);
  return [...names];
}
