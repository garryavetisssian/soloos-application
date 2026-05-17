// Server-side HTML fetch + cleanup for the job-research route.
//
// Hardening:
//   - http/https only (block file://, ftp://, etc.)
//   - Hostname-based SSRF guard: blocks localhost, *.local, IPv4 private/
//     loopback/link-local ranges, and a couple of IPv6 cases.
//   - 10s fetch timeout via AbortSignal.
//   - 2 MB body cap (Content-Length pre-check + post-read sanity check).
//   - Cheerio strips scripts/styles/nav/footer/aside/cookie banners before
//     extracting visible text. Prefers <article>/main; falls back to body.
//   - Final text capped at 50 KB before being handed to Gemini.

import * as cheerio from "cheerio";

const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_TEXT_CHARS = 50_000;
const MIN_USEFUL_TEXT_CHARS = 200;
const FETCH_TIMEOUT_MS = 10_000;

export type ExtractFailureReason =
  | "invalid_url"
  | "internal_url"
  | "blocked"
  | "not_found"
  | "timeout"
  | "low_content"
  | "js_required"
  | "fetch_failed";

export interface ExtractSuccess {
  ok: true;
  url: string;
  title: string;
  metaDescription: string;
  text: string;
}

export interface ExtractFailure {
  ok: false;
  reason: ExtractFailureReason;
  httpStatus?: number;
  detail?: string;
}

export type ExtractResult = ExtractSuccess | ExtractFailure;

// Detect a JS-required stub page. Conservative: looks for known
// phrases (en/ru/hy) only when the cleaned text is also unusually
// short. Real job pages have hundreds of words; the stub is a few
// lines.
const JS_REQUIRED_PHRASES = [
  "enable javascript",
  "please enable javascript",
  "включите javascript",
  "необходимо.*?javascript",
  "произошла ошибка.*?перезагрузить страницу",
  "միացրեք javascript",
];
const JS_REQUIRED_RE = new RegExp(JS_REQUIRED_PHRASES.join("|"), "i");

function looksLikeJsRequiredStub(text: string, hostname: string): boolean {
  // Cap the heuristic at moderately-short bodies — long pages that
  // happen to mention "enable JavaScript" in a footer aren't stubs.
  // The cap is generous because hh.ru's stub is ~340k chars of
  // boilerplate around a single error message; we look at the first
  // 4k since the error sits near the top.
  const head = text.slice(0, 4000);
  if (JS_REQUIRED_RE.test(head)) return true;
  // hh.ru-specific extra check: their stub uses "Произошла ошибка"
  // near the top regardless of language toggles.
  if (
    (hostname === "hh.ru" || hostname.endsWith(".hh.ru")) &&
    /произошла ошибка/i.test(head)
  ) {
    return true;
  }
  return false;
}

function isInternalHostname(hostname: string): boolean {
  if (!hostname) return true;
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h === "0.0.0.0" ||
    h === "::" ||
    h === "::1"
  )
    return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  const m = h.match(/^172\.(\d+)\./);
  if (m) {
    const second = parseInt(m[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  // IPv6 link-local
  if (h.startsWith("fe80:") || h.startsWith("[fe80:")) return true;
  return false;
}

export async function extractJobPage(rawUrl: string): Promise<ExtractResult> {
  // ---- 1. URL validation ----
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "invalid_url" };
  }
  if (isInternalHostname(url.hostname)) {
    return { ok: false, reason: "internal_url" };
  }

  // ---- 2. Fetch (manual redirect walk for SSRF safety) ----
  // Node's fetch with redirect:"follow" silently chases Location headers
  // without giving us a hook to re-validate the destination. A public
  // URL can 302 to http://169.254.169.254 (cloud metadata) or any
  // private host and we'd happily fetch it. Walking redirects by hand
  // re-runs the protocol + isInternalHostname guard on every hop.
  const MAX_REDIRECTS = 5;
  const fetchHeaders = {
    "user-agent": "Mozilla/5.0 (compatible; SoloOSBot/1.0)",
    accept: "text/html,application/xhtml+xml",
    "accept-language": "en,en-US;q=0.9",
  };
  let response: Response;
  let current = url.toString();
  let redirectsLeft = MAX_REDIRECTS;
  while (true) {
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: fetchHeaders,
      });
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e.name === "AbortError" || /timeout|abort/i.test(e.message ?? "")) {
        return { ok: false, reason: "timeout", detail: e.message };
      }
      return { ok: false, reason: "fetch_failed", detail: e.message };
    }
    // Terminal response (non-3xx) — fall through to the status checks below.
    if (response.status < 300 || response.status >= 400) break;
    // 3xx — validate the Location target before following it.
    if (redirectsLeft <= 0) {
      return {
        ok: false,
        reason: "fetch_failed",
        detail: "too many redirects",
      };
    }
    const location = response.headers.get("location");
    if (!location) break; // odd 3xx with no Location header — treat as terminal.
    let nextUrl: URL;
    try {
      nextUrl = new URL(location, current); // resolves relative redirects.
    } catch {
      return {
        ok: false,
        reason: "fetch_failed",
        detail: "invalid redirect target",
      };
    }
    if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
      return { ok: false, reason: "invalid_url" };
    }
    if (isInternalHostname(nextUrl.hostname)) {
      return { ok: false, reason: "internal_url" };
    }
    current = nextUrl.toString();
    redirectsLeft--;
  }

  if (
    response.status === 401 ||
    response.status === 403 ||
    response.status === 451 ||
    response.status === 429
  ) {
    return { ok: false, reason: "blocked", httpStatus: response.status };
  }
  if (response.status === 404 || response.status === 410) {
    return { ok: false, reason: "not_found", httpStatus: response.status };
  }
  if (!response.ok) {
    return {
      ok: false,
      reason: "fetch_failed",
      httpStatus: response.status,
    };
  }

  // ---- 3. Size guard before reading the body ----
  const contentLength = parseInt(
    response.headers.get("content-length") ?? "0",
    10,
  );
  if (contentLength > MAX_HTML_BYTES) {
    return { ok: false, reason: "fetch_failed", detail: "page too large" };
  }

  let html: string;
  try {
    html = await response.text();
  } catch (err) {
    return {
      ok: false,
      reason: "fetch_failed",
      detail: (err as Error).message,
    };
  }
  if (html.length > MAX_HTML_BYTES) {
    return { ok: false, reason: "fetch_failed", detail: "page too large" };
  }

  // ---- 4. Cheerio cleanup ----
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, link[rel='stylesheet']").remove();
  $("nav, footer, aside").remove();
  $(
    "[role='navigation'], [role='banner'], [role='contentinfo'], [role='complementary']",
  ).remove();
  // Common cookie/consent banners.
  $(
    [
      "[id*='cookie' i]",
      "[class*='cookie' i]",
      "[id*='consent' i]",
      "[class*='consent' i]",
      "[id*='gdpr' i]",
      "[class*='gdpr' i]",
      "[aria-label*='cookie' i]",
    ].join(", "),
  ).remove();

  const title = ($("title").first().text() || "").trim();
  const metaDescription = (
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    ""
  ).trim();

  // Prefer the most likely content region; fall back to body.
  let text = $("article, [role='main'], main").first().text();
  if (!text || text.replace(/\s/g, "").length < 100) {
    text = $("body").text();
  }
  text = text.replace(/\s+/g, " ").trim();
  if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS);

  // Some sites (notably hh.ru) serve a "please enable JavaScript" stub
  // to non-browser fetches and only render real content client-side.
  // Detect a few well-known phrases — across English, Russian, and
  // Armenian — so we can return a specific failure code instead of
  // letting Gemini see the stub and decide it's "not a job page".
  if (looksLikeJsRequiredStub(text, url.hostname)) {
    return { ok: false, reason: "js_required" };
  }

  if (text.length < MIN_USEFUL_TEXT_CHARS) {
    return { ok: false, reason: "low_content" };
  }

  return {
    ok: true,
    url: url.toString(),
    title,
    metaDescription,
    text,
  };
}
