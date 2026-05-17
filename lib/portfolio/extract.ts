// Future portfolio intelligence pipeline (NOT YET IMPLEMENTED).
//
// Planned flow:
//   1. Fetch the portfolio URL server-side (timeout, redirect cap, max body
//      size, deny-list for internal IPs to prevent SSRF).
//   2. Parse the HTML and extract visible text.
//   3. Detect project links (likely <a> tags inside main/article regions).
//   4. Optionally fetch each project subpage with the same safeguards.
//   5. Optionally pass screenshots / cover images through Gemini vision for
//      visual project parsing.
//   6. Persist the structured project context as a `portfolio_sources` row
//      and reference the extracted projects when generating cover letters.
//
// Not yet built because:
//   - JS-only sites won't yield useful text without a headless browser; the
//     operational cost (and Vercel function size) needs to be settled first.
//   - SSRF / robots.txt / rate-limit handling needs a clear story.
//   - We don't want to fake portfolio analysis: until SoloOS has actually
//     read the projects, the UI must not claim it has. The cover-letter
//     prompt currently includes only the portfolio URL — Gemini may
//     reference it, but won't pretend to know what's there.
//
// Until this is wired, the user's profile carries portfolio_url only and
// the cover-letter context surfaces it via lib/profile.ts's
// profileToCandidateContext.

import type { PortfolioProject, PortfolioSource } from "./types";

export interface ExtractResult {
  ok: boolean;
  source: PortfolioSource | null;
  projects: PortfolioProject[];
}

export async function extractPortfolio(
  _url: string,
): Promise<ExtractResult> {
  // TODO: implement once the architecture and quotas above are settled.
  return { ok: false, source: null, projects: [] };
}
