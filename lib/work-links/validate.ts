// Validate a portfolio URL — fetch, classify, sniff for login walls,
// extract title + cleaned page text. Returns a single discriminated
// union the server action can map to either a save or a user-facing
// error.
//
// Phase 1 strategy: rely on the generic HTML extractor for everything.
// Per-platform deep checks (GitHub API, Figma API, Vision) layer on in
// Phase 2 — for now a 200 OK + visible body + no obvious login wall is
// treated as "publicly viewable enough" to enrich.

import { extractJobPage } from "@/lib/html-extract";
import { classifyUrl } from "./classify";
import {
  extractFigmaApiContent,
  renderFigmaApiContentAsText,
} from "./figma";
import { extractFigmaFilePublic } from "./figma-public";
import type { QualitySignals, WorkLinkType } from "./types";

export type ValidationErrorCode =
  | "invalid_url"
  | "internal_url"
  | "unreachable"
  | "not_found"
  | "login_wall"
  | "blocked"
  | "low_content"
  | "figma_unconfigured"
  | "rate_limited";

export interface ValidationSuccess {
  ok: true;
  url: string;
  type: WorkLinkType;
  title: string;
  text: string;
  thumbnailUrl: string | null;
  /** Figma-only: file key, used downstream for Vision rendering. */
  figmaFileKey?: string;
  /** Figma-only: candidate node IDs for Vision rendering. */
  figmaFrameIds?: string[];
  /** Structural counts captured at validation time (Figma only for
   *  now). Stored as JSONB and used by the quality bar. Null when
   *  deep extraction wasn't possible (rate-limit, non-Figma type). */
  qualitySignals: QualitySignals;
}

export interface ValidationFailure {
  ok: false;
  code: ValidationErrorCode;
  /**
   * User-facing message that names what's wrong and what to fix.
   * Server route uses this directly — never returns raw fetch errors.
   */
  message: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

// Heuristics for detecting login walls in the cleaned page text. The
// HTML extractor strips script/style, so what we see is essentially what
// the user would see — if "Sign in" / "Login required" dominates a tiny
// body, the page isn't publicly visible. We avoid being too aggressive:
// most real portfolios contain "Sign up to my newsletter" or similar
// language too, so we only flag when the body is short AND uses login-
// wall vocabulary.
const LOGIN_WALL_PATTERNS = [
  /\bsign\s*in\b/i,
  /\blog\s*in\b/i,
  /\bsign\s*up\s+to\s+(?:continue|view|read)/i,
  /\bmember[s]?\s+only\b/i,
  /\bauthentication\s+required\b/i,
  /\bplease\s+sign\s+in\b/i,
  // Russian + Armenian — extremely common platforms have non-English walls.
  /\bвойти\b/i,
  /\bвход\b/i,
  /մուտք/i,
];

function looksLikeLoginWall(text: string): boolean {
  if (text.length > 1500) return false;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const re of LOGIN_WALL_PATTERNS) {
    if (re.test(lower)) hits++;
    if (hits >= 2) return true;
  }
  // Single very strong indicator on a tiny page → wall.
  if (hits === 1 && text.length < 400) return true;
  return false;
}

// Format a wait duration into the most useful human phrasing for an
// error message. "<60s" → "less than a minute"; "<1h" → "X minutes";
// "<24h" → "X hours"; else → "X days".
function humanizeWaitSeconds(s: number): string {
  if (s < 60) return "less than a minute";
  if (s < 3600) return `${Math.ceil(s / 60)} minutes`;
  if (s < 86400) return `${Math.ceil(s / 3600)} hours`;
  return `${Math.ceil(s / 86400)} days`;
}

// Friendly per-platform copy when something fails. The user must always
// know exactly what to fix.
function friendlyMessageForCode(
  code: ValidationErrorCode,
  type: WorkLinkType,
  extras?: { retryAfterSeconds?: number },
): string {
  switch (code) {
    case "invalid_url":
      return "That doesn't look like a valid URL. Make sure it starts with http:// or https://.";
    case "internal_url":
      return "We can't reach internal URLs. Use a public, publicly accessible link.";
    case "unreachable":
      return "We couldn't reach this URL. Check the address or try again in a moment.";
    case "not_found":
      return "This page returned 'not found'. Double-check the URL.";
    case "login_wall": {
      if (type === "figma") {
        return "This Figma file is private. Open it in Figma → Share → set to 'Anyone with the link can view' → try again.";
      }
      if (type === "github") {
        return "This GitHub repo looks private or doesn't exist. Make it public, or check the URL.";
      }
      if (type === "dribbble" || type === "behance") {
        return "We hit a sign-in wall on this page. Make sure the link points to a public shot or project.";
      }
      return "This link requires sign-in to view. Cover letters can only reference publicly accessible links.";
    }
    case "blocked":
      return "This site blocks automated readers, so we can't pull content from it. You can still add it manually below.";
    case "low_content":
      return "We could load the page but couldn't find enough content to summarise. Make sure it's not a placeholder.";
    case "figma_unconfigured":
      return "Figma support isn't configured on this server. Add FIGMA_ACCESS_TOKEN to your environment variables (see Figma → Account Settings → Personal Access Tokens) and restart.";
    case "rate_limited":
      if (type === "figma") {
        // Figma's free Starter plan locks a file's API access for days
        // after the per-file quota is exceeded. Surface the real wait
        // when we have it, with the upgrade path as context.
        const wait = extras?.retryAfterSeconds;
        const when = wait ? ` (about ${humanizeWaitSeconds(wait)})` : "";
        return `Figma's free plan rate-limits API access to each file. This specific file is locked${when} before we can read it again. Other public Figma files still work — and if this is your file, upgrading to a paid Figma plan removes the limit.`;
      }
      return "We've hit a rate limit on the source site. Try again in a minute.";
  }
}

// HEAD request to learn the byte size of a resource without
// downloading it. Used to detect sparse Figma thumbnails (which
// indicate an empty cover) at validation time. Returns 0 on any
// failure — the score downgrades gracefully.
async function probeContentLength(url: string | null): Promise<number> {
  if (!url) return 0;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: {
        "user-agent": "Mozilla/5.0 (SoloOSBot/1.0)",
        accept: "image/*",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return 0;
    const cl = parseInt(res.headers.get("content-length") ?? "0", 10);
    return Number.isFinite(cl) && cl > 0 ? cl : 0;
  } catch {
    return 0;
  }
}

export async function validateWorkLink(rawUrl: string): Promise<ValidationResult> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, code: "invalid_url", message: friendlyMessageForCode("invalid_url", "other") };
  }

  // Normalise: prepend https:// if user pasted "example.com/foo"
  const normalised = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(normalised);
  } catch {
    return { ok: false, code: "invalid_url", message: friendlyMessageForCode("invalid_url", "other") };
  }

  const type = classifyUrl(parsed.toString());

  // Figma — two-source extraction.
  //
  //   1. ALWAYS: public-HTML scrape gives us the thumbnail URL +
  //      file name. Free, no quota, works even when the file's API
  //      access is rate-locked.
  //
  //   2. BEST-EFFORT: a single /v1/files call deep-walks the
  //      document tree and pulls page names, named frames, and every
  //      TEXT layer's content (button labels, headings, body copy).
  //      Costs 1 API call per add. Returns null on rate-lock / no
  //      token / network issue — in which case we degrade to (1).
  //
  // Gemini Vision then gets BOTH the thumbnail image AND the
  // structured text-layer content. Files with sparse thumbnails but
  // rich canvas typography (UI mockups, marketing pages) finally
  // produce real summaries.
  if (type === "figma") {
    const fig = await extractFigmaFilePublic(parsed.toString());
    if (!fig.ok) {
      const code: ValidationErrorCode =
        fig.reason === "invalid_url"
          ? "invalid_url"
          : fig.reason === "private_or_not_found"
            ? "login_wall"
            : "unreachable";
      return {
        ok: false,
        code,
        message: friendlyMessageForCode(code, type),
      };
    }
    const apiContent = await extractFigmaApiContent(parsed.toString());
    const text = apiContent
      ? renderFigmaApiContentAsText(apiContent)
      : fig.text;
    // Cheap HEAD probe to capture the thumbnail's byte size — this
    // is a strong signal of whether the cover is blank vs rich.
    // Free (no auth, no Figma API quota), runs in parallel with the
    // API content fetch above when the call order is optimised.
    const thumbBytes = await probeContentLength(fig.thumbnailUrl);
    // Always emit a signals object — we have at least the thumbnail
    // size and the file name. When the API call failed (rate-lock,
    // etc.) the structural counts are zeros and `apiBlocked: true`
    // surfaces *why* in the UI. The score function caps accordingly.
    // topFrameIds are persisted so a future recheck can re-render
    // them via /v1/images (a separate Figma quota pool) even when
    // /v1/files is rate-locked for this file.
    const qualitySignals: QualitySignals = apiContent
      ? {
          kind: "figma",
          thumbBytes,
          ...apiContent.signals,
          apiBlocked: false,
          topFrameIds: apiContent.topFrameIds,
        }
      : {
          kind: "figma",
          thumbBytes,
          pageCount: 0,
          frameCount: 0,
          namedFrameCount: 0,
          componentCount: 0,
          styleCount: 0,
          textLayerCount: 0,
          meaningfulTextCount: 0,
          imageFillCount: 0,
          apiBlocked: true,
          topFrameIds: [],
        };
    return {
      ok: true,
      url: parsed.toString(),
      type: "figma",
      title: apiContent?.fileName ?? fig.fileName,
      text,
      thumbnailUrl: fig.thumbnailUrl,
      figmaFileKey: fig.fileKey,
      // Frame IDs are surfaced when API succeeded — used as a
      // fallback when the thumbnail itself is too sparse for Vision
      // (see enrich.ts tiny-thumb logic).
      figmaFrameIds: apiContent?.topFrameIds ?? [],
      qualitySignals,
    };
  }

  // Delegate the heavy lifting (SSRF guard, timeout, body cap, HTML
  // cleanup) to the existing extractor. Map its failure reasons onto
  // our user-facing codes.
  const result = await extractJobPage(parsed.toString());
  if (!result.ok) {
    const code: ValidationErrorCode =
      result.reason === "invalid_url"
        ? "invalid_url"
        : result.reason === "internal_url"
          ? "internal_url"
          : result.reason === "not_found"
            ? "not_found"
            : result.reason === "blocked"
              ? "blocked"
              : result.reason === "low_content"
                ? "low_content"
                : "unreachable";
    return { ok: false, code, message: friendlyMessageForCode(code, type) };
  }

  if (looksLikeLoginWall(result.text)) {
    return {
      ok: false,
      code: "login_wall",
      message: friendlyMessageForCode("login_wall", type),
    };
  }

  // Pull og:image from the raw extracted title page if we can. The
  // extractor doesn't currently surface meta tags beyond description;
  // for Phase 1 we leave thumbnail null and rely on a favicon in the
  // UI. Phase 2 will add og:image lookup as part of the per-type
  // enrichment pipeline.
  return {
    ok: true,
    url: parsed.toString(),
    type,
    title: result.title || parsed.hostname,
    text: result.text,
    thumbnailUrl: null,
    qualitySignals: null,
  };
}
