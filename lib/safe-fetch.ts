// Single hardened fetch helper used by every server-side outbound call
// in SoloOS. Consolidates three protections that were previously scattered
// (or missing) across html-extract.ts, figma.ts, figma-public.ts,
// figma-render.ts, validate.ts, and hh-ru.ts:
//
//   1. Protocol guard — http:// and https:// only. Rejects file://,
//      data://, gopher://, etc.
//   2. SSRF guard — resolves DNS to A/AAAA and rejects any address in
//      private / loopback / link-local / multicast / metadata ranges.
//      Catches both literal hostnames (`localhost`, `127.0.0.1`) and
//      DNS-rebinding attacks (`evil.example.com` → 169.254.169.254).
//   3. Manual redirect walking — Node fetch with `redirect: "follow"`
//      silently chases Location headers without revalidation. We use
//      `redirect: "manual"` and re-run guards 1 + 2 on every hop.
//
// Plus: per-request timeout, response-size cap, opt-in optional checks
// like content-length pre-read.
//
// All call sites should route through `safeFetch` instead of native
// `fetch` for any URL that is, transitively, user-supplied.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface SafeFetchOptions {
  /** Forwarded to native fetch — headers, body, method, signal, etc. */
  init?: RequestInit;
  /** Overall timeout in ms. Default 10s. */
  timeoutMs?: number;
  /** Max redirects to follow. Default 5. */
  maxRedirects?: number;
  /** Optional content-length cap (bytes) — short-circuits when known. */
  maxBytes?: number;
}

export type SafeFetchError =
  | "invalid_url"
  | "internal_url"
  | "blocked_protocol"
  | "too_many_redirects"
  | "timeout"
  | "fetch_failed"
  | "too_large";

export type SafeFetchResult =
  | { ok: true; response: Response; finalUrl: string }
  | { ok: false; reason: SafeFetchError; detail?: string };

// ---- Protocol + IP guards ---------------------------------------------------

function isAllowedProtocol(p: string): boolean {
  return p === "http:" || p === "https:";
}

// IPv4 ranges we refuse to fetch. Covers:
//   - 10.0.0.0/8        — RFC1918 private
//   - 172.16.0.0/12     — RFC1918 private
//   - 192.168.0.0/16    — RFC1918 private
//   - 127.0.0.0/8       — loopback
//   - 169.254.0.0/16    — link-local (incl. cloud metadata 169.254.169.254)
//   - 0.0.0.0/8         — current network / wildcard
//   - 100.64.0.0/10     — carrier-grade NAT
//   - 224.0.0.0/4       — multicast
//   - 240.0.0.0/4       — reserved
function isInternalIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

// IPv6 ranges we refuse. Conservative — we block more than strictly
// required (e.g., site-local fc00::/7) because there's no legitimate
// reason for a public job-page fetch to hit those.
function isInternalIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb"))
    return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  if (lower.startsWith("ff")) return true; // multicast
  // IPv4-mapped IPv6 (::ffff:x.x.x.x) — re-check the embedded IPv4.
  const mappedMatch = lower.match(/::ffff:([0-9.]+)/);
  if (mappedMatch && isInternalIPv4(mappedMatch[1])) return true;
  return false;
}

// Resolves the hostname to an IP and verifies the IP is publicly
// routable. Handles literal IPs directly (no DNS lookup needed) and
// rejects unparseable inputs.
async function resolveAndCheckIp(hostname: string): Promise<{
  ok: true;
  ip: string;
} | { ok: false; reason: "internal_url" | "fetch_failed"; detail?: string }> {
  if (!hostname) return { ok: false, reason: "internal_url" };

  // Literal IP — check directly without DNS.
  if (isIP(hostname)) {
    const internal =
      isIP(hostname) === 4
        ? isInternalIPv4(hostname)
        : isInternalIPv6(hostname);
    if (internal) return { ok: false, reason: "internal_url" };
    return { ok: true, ip: hostname };
  }

  // Hostname strings. Catch literal local names.
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local")
  ) {
    return { ok: false, reason: "internal_url" };
  }

  try {
    const { address, family } = await lookup(hostname);
    const internal =
      family === 4 ? isInternalIPv4(address) : isInternalIPv6(address);
    if (internal) return { ok: false, reason: "internal_url" };
    return { ok: true, ip: address };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return {
      ok: false,
      reason: "fetch_failed",
      detail: e.code ?? e.message ?? "DNS lookup failed",
    };
  }
}

async function validateUrl(rawUrl: string): Promise<
  { ok: true; url: URL } | { ok: false; reason: SafeFetchError; detail?: string }
> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (!isAllowedProtocol(url.protocol)) {
    return { ok: false, reason: "blocked_protocol" };
  }
  const ipCheck = await resolveAndCheckIp(url.hostname);
  if (!ipCheck.ok) {
    return { ok: false, reason: ipCheck.reason, detail: ipCheck.detail };
  }
  return { ok: true, url };
}

// ---- Public entry point -----------------------------------------------------

/**
 * Fetch a URL with full SSRF protection.
 *
 * Walks redirects manually, re-validating every hop. The returned
 * `response` has a fully-consumable body (caller decides whether to
 * `.text()`, `.json()`, etc.). `finalUrl` is the post-redirect URL.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxRedirects = options.maxRedirects ?? 5;

  let currentUrl = rawUrl;
  let redirectsLeft = maxRedirects;
  let response: Response | null = null;

  while (true) {
    const validated = await validateUrl(currentUrl);
    if (!validated.ok) {
      return {
        ok: false,
        reason: validated.reason,
        detail: validated.detail,
      };
    }

    try {
      response = await fetch(validated.url.toString(), {
        ...options.init,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (
        e.name === "AbortError" ||
        /timeout|abort/i.test(e.message ?? "")
      ) {
        return { ok: false, reason: "timeout", detail: e.message };
      }
      return { ok: false, reason: "fetch_failed", detail: e.message };
    }

    // Non-3xx — terminal response.
    if (response.status < 300 || response.status >= 400) {
      // Optional content-length pre-check.
      if (options.maxBytes != null) {
        const cl = parseInt(response.headers.get("content-length") ?? "0", 10);
        if (Number.isFinite(cl) && cl > options.maxBytes) {
          return { ok: false, reason: "too_large", detail: `content-length=${cl}` };
        }
      }
      return { ok: true, response, finalUrl: validated.url.toString() };
    }

    // 3xx — follow + re-validate, or fail on too-many-redirects.
    if (redirectsLeft <= 0) {
      return { ok: false, reason: "too_many_redirects" };
    }
    const location = response.headers.get("location");
    if (!location) {
      // Odd 3xx with no Location — treat the current response as terminal.
      return { ok: true, response, finalUrl: validated.url.toString() };
    }
    try {
      const nextUrl = new URL(location, validated.url);
      currentUrl = nextUrl.toString();
    } catch {
      return {
        ok: false,
        reason: "fetch_failed",
        detail: "invalid redirect target",
      };
    }
    redirectsLeft -= 1;
  }
}
