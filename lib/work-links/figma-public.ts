// Public-HTML scrape of a Figma file. No auth, no API token, no
// per-file rate limit — fetches the same URL the user pasted as plain
// HTML and parses og:image / twitter:title / og:article:modified_time.
//
// Why this exists: Figma's free Starter plan rate-limits /v1/files and
// /v1/images per-file, and once you blow through the quota a file
// stays locked for *days*. But the public file URL — the same one the
// owner shared — exposes the full social-share metadata including a
// rendered thumbnail PNG hosted on figma.com (not the API). That
// endpoint is unauthenticated and quota-free. We use it as the
// default Figma extraction path and never call the API for typical
// adds — the lockout simply cannot happen.
//
// What we get from the HTML:
//   • File name        — `<meta name="twitter:title">`
//   • Thumbnail URL    — `<meta property="og:image">`
//   • Last modified    — `<meta property="og:article:modified_time">`
//   • Created at       — `<meta property="og:article:published_time">`
// Plus a sanity signal that the file is genuinely public (vs a
// login-walled private file, which Figma serves with a fallback
// thumbnail and no real title).

import * as cheerio from "cheerio";
import { parseFigmaFileKey } from "./figma";

const FETCH_TIMEOUT_MS = 15_000;
// Realistic browser UA — Figma serves social-share metadata to bots
// and browsers alike, but using a real UA avoids any future
// anti-scraping heuristics.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

export interface FigmaPublicExtraction {
  ok: true;
  fileKey: string;
  fileName: string;
  thumbnailUrl: string;
  lastModified: string | null;
  /** Synthetic text doc for the Vision prompt — mostly empty here
   *  because the document tree isn't accessible without the API,
   *  but we still pass the file name as context. */
  text: string;
}

export interface FigmaPublicExtractionError {
  ok: false;
  reason: "invalid_url" | "private_or_not_found" | "fetch_failed";
}

export type FigmaPublicResult =
  | FigmaPublicExtraction
  | FigmaPublicExtractionError;

export async function extractFigmaFilePublic(
  rawUrl: string,
): Promise<FigmaPublicResult> {
  const fileKey = parseFigmaFileKey(rawUrl);
  if (!fileKey) return { ok: false, reason: "invalid_url" };

  let html: string;
  try {
    const res = await fetch(rawUrl, {
      headers: {
        "user-agent": BROWSER_UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en,en-US;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 404) {
      return { ok: false, reason: "private_or_not_found" };
    }
    if (!res.ok) {
      return { ok: false, reason: "fetch_failed" };
    }
    html = await res.text();
  } catch (err) {
    console.warn("[figma-public] fetch failed", err);
    return { ok: false, reason: "fetch_failed" };
  }

  const $ = cheerio.load(html);
  const ogImage = decodeMeta($('meta[property="og:image"]').attr("content"));
  const twitterTitle = decodeMeta(
    $('meta[name="twitter:title"]').attr("content"),
  );
  const ogTitle = decodeMeta($('meta[property="og:title"]').attr("content"));
  const lastModified = decodeMeta(
    $('meta[property="og:article:modified_time"]').attr("content"),
  );

  // Heuristic: a private / inaccessible Figma file still serves an
  // og:image, but it points to a generic Figma marketing image rather
  // than a file-specific thumbnail. Real file thumbnails live under
  // `figma.com/file/{key}/thumbnail`. If we don't see that pattern,
  // treat it as inaccessible.
  if (!ogImage || !ogImage.includes("/thumbnail")) {
    return { ok: false, reason: "private_or_not_found" };
  }

  const fileName =
    (twitterTitle || ogTitle || "").trim() || "Untitled Figma file";

  return {
    ok: true,
    fileKey,
    fileName,
    thumbnailUrl: ogImage,
    lastModified: lastModified || null,
    text: `Figma file: ${fileName}${lastModified ? `\nLast modified: ${lastModified}` : ""}`,
  };
}

// Figma's HTML escapes forward slashes in meta values as `&#47;`.
// cheerio's .attr() returns the raw attribute string, so we have to
// decode those ourselves. Generic html-entities decoding is overkill
// for this one case.
function decodeMeta(s: string | undefined): string {
  if (!s) return "";
  return s.replace(/&#x?([0-9a-f]+);/gi, (_, code) =>
    String.fromCodePoint(parseInt(code, code.startsWith("x") ? 16 : 10)),
  );
}
