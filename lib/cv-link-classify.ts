// Detect and classify URLs found in CV text.
//
// Used during profile enhancement to auto-fill linkedin_url and portfolio_url
// when the user uploads a CV. Pure function, no IO — runs on the server in
// /api/ai/profile-enhance, but the types are imported by the client too.
//
// Design notes:
//   - Regex extraction is deterministic; AI's detected_links is best-effort.
//     The route merges them with regex winning on conflicts.
//   - We classify *aggressively* into types but only auto-apply to a profile
//     field when confidence is high. Personal-domain entries auto-apply to
//     portfolio_url at 0.6 confidence (require a path) or 0.4 (root only).
//   - We deliberately exclude linkedin.com/company/ from linkedin_url.

export type DetectedLinkType =
  | "linkedin"
  | "linkedin_company"
  | "github"
  | "portfolio_platform"
  | "social"
  | "personal"
  | "unknown";

export interface DetectedLink {
  url: string;
  type: DetectedLinkType;
  confidence: number; // 0..1
  // Which profile field this would auto-fill, if any.
  field: "linkedin_url" | "portfolio_url" | null;
}

export interface ClassifyResult {
  linkedin_url: string;
  portfolio_url: string;
  detected_links: DetectedLink[];
}

// Match URL-ish substrings. Tolerant of trailing punctuation; we strip and
// validate later via the URL constructor.
const URL_RE =
  /https?:\/\/[^\s)\]<>"'`]+|www\.[^\s)\]<>"'`]+|[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s)\]<>"'`]*)?/gi;

const PORTFOLIO_HOST_RES: ReadonlyArray<RegExp> = [
  /(^|\.)behance\.net$/i,
  /(^|\.)dribbble\.com$/i,
  /(^|\.)readymag\.com$/i,
  /(^|\.)webflow\.io$/i,
  /(^|\.)framer\.website$/i,
  /(^|\.)framer\.ai$/i,
  /(^|\.)carbonmade\.com$/i,
  /(^|\.)cargo\.site$/i,
  /(^|\.)uxfol\.io$/i,
];

const SOCIAL_HOST_RES: ReadonlyArray<RegExp> = [
  /(^|\.)facebook\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)telegram\.me$/i,
  /(^|\.)t\.me$/i,
  /(^|\.)medium\.com$/i,
  /(^|\.)substack\.com$/i,
];

// Conservative TLD list for treating bare hosts as personal sites. Things
// like "Mr.Smith" don't match anything here, so they fall through to
// "unknown" rather than being applied as a portfolio.
const PERSONAL_TLD_RE =
  /\.(com|net|org|io|co|me|ai|app|design|dev|site|page|studio|agency|art|tech|info|biz|xyz|us|uk|de|fr|ru|am|ge|nl|fi|jp|cn|kr|br|in|au|ca|es|it|pt|se|no|dk|pl|cz|gr|tr|ar|mx|cl|sg)$/i;

function normalizeUrl(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  // Strip surrounding/trailing punctuation that often hugs URLs in prose.
  s = s.replace(/^[<({\[]+/, "");
  s = s.replace(/[>)}\]]+$/, "");
  s = s.replace(/[.,;:!?]+$/g, "");
  s = s.replace(/['"`]+$/, "");
  if (!s) return null;
  // Add a protocol if missing.
  if (!/^https?:\/\//i.test(s)) {
    if (!/^www\./i.test(s) && !/^[a-z0-9-]+\.[a-z0-9-]+/i.test(s)) {
      return null;
    }
    s = "https://" + s;
  }
  try {
    const u = new URL(s);
    // Strip trailing slash for cleaner equality, except when path is empty.
    const pathname =
      u.pathname && u.pathname !== "/" ? u.pathname.replace(/\/$/, "") : "";
    return `${u.protocol}//${u.host}${pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

function classifyOne(url: string): DetectedLink {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url, type: "unknown", confidence: 0, field: null };
  }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  // LinkedIn personal profile: linkedin.com/in/ or linkedin.com/profile/.
  // Company pages are recorded but explicitly NOT used as the personal field.
  if (/(^|\.)linkedin\.com$/.test(host)) {
    if (/^\/(in|profile)\//.test(path)) {
      return { url, type: "linkedin", confidence: 1.0, field: "linkedin_url" };
    }
    if (/^\/company\//.test(path)) {
      return {
        url,
        type: "linkedin_company",
        confidence: 0.6,
        field: null,
      };
    }
    return { url, type: "linkedin", confidence: 0.4, field: null };
  }

  if (/(^|\.)github\.com$/.test(host)) {
    return { url, type: "github", confidence: 0.9, field: null };
  }

  if (PORTFOLIO_HOST_RES.some((re) => re.test(host))) {
    return {
      url,
      type: "portfolio_platform",
      confidence: 0.9,
      field: "portfolio_url",
    };
  }

  if (SOCIAL_HOST_RES.some((re) => re.test(host))) {
    return { url, type: "social", confidence: 0.9, field: null };
  }

  // Personal domain heuristic: must end in a recognized TLD. Higher
  // confidence when the URL has a real path component.
  if (PERSONAL_TLD_RE.test(host)) {
    const hasPath = path && path !== "/";
    return {
      url,
      type: "personal",
      confidence: hasPath ? 0.6 : 0.4,
      field: "portfolio_url",
    };
  }

  return { url, type: "unknown", confidence: 0, field: null };
}

function pickBest(
  links: DetectedLink[],
  field: "linkedin_url" | "portfolio_url",
  minConfidence: number,
): string {
  const candidate = links
    .filter((d) => d.field === field && d.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence)[0];
  return candidate?.url ?? "";
}

export function classifyCvLinks(text: string): ClassifyResult {
  if (!text) {
    return { linkedin_url: "", portfolio_url: "", detected_links: [] };
  }

  const detected: DetectedLink[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(URL_RE)) {
    const norm = normalizeUrl(match[0]);
    if (!norm) continue;
    const key = norm.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    detected.push(classifyOne(norm));
  }

  return {
    linkedin_url: pickBest(detected, "linkedin_url", 1.0),
    // Prefer a known portfolio platform; if none, accept a personal domain.
    portfolio_url:
      pickBest(detected, "portfolio_url", 0.9) ||
      pickBest(detected, "portfolio_url", 0.4),
    detected_links: detected,
  };
}

// Merge detected links from regex (preferred) and AI. AI URLs are normalized
// and re-classified via classifyOne so both sources end up in the same shape.
// Dedupe by normalized URL; regex entries win.
export function mergeDetectedLinks(
  regexLinks: DetectedLink[],
  aiLinks: ReadonlyArray<{ url: string; type?: string; confidence?: number }>,
): DetectedLink[] {
  const map = new Map<string, DetectedLink>();
  for (const link of regexLinks) {
    map.set(link.url.toLowerCase(), link);
  }
  for (const ai of aiLinks) {
    const norm = normalizeUrl(ai.url);
    if (!norm) continue;
    const key = norm.toLowerCase();
    if (map.has(key)) continue;
    map.set(key, classifyOne(norm));
  }
  return Array.from(map.values());
}
