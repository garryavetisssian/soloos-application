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
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { gunzipSync, inflateSync, brotliDecompressSync } from "node:zlib";

export interface SafeFetchOptions {
  /** GET/HEAD request headers and caller cancellation signal. */
  init?: RequestInit;
  /** Overall timeout in ms. Default 10s. */
  timeoutMs?: number;
  /** Max redirects to follow. Default 5. */
  maxRedirects?: number;
  /** Stream and decompressed response cap in bytes. Defaults to 8 MiB. */
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
export function isInternalIPv4(ip: string): boolean {
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
  if (a === 192 && (b === 0 || b === 2)) return true;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  return false;
}

// IPv6 ranges we refuse. Conservative — we block more than strictly
// required (e.g., site-local fc00::/7) because there's no legitimate
// reason for a public job-page fetch to hit those.
export function isInternalIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  const first = parseInt(lower.split(":")[0], 16);
  if (!Number.isFinite(first) || first < 0x2000 || first > 0x3fff || first === 0x2002 || /^2001:(?:0:|db8:)/.test(lower)) return true;
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
    const entries = await lookup(hostname, { all: true });
    if (!entries.length || entries.some(e => e.family === 4 ? isInternalIPv4(e.address) : isInternalIPv6(e.address))) return { ok: false, reason: "internal_url" };
    const { address, family } = entries[0];
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
  { ok: true; url: URL; ip: string } | { ok: false; reason: SafeFetchError; detail?: string }
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
  if (url.username || url.password) return { ok: false, reason: "invalid_url" };
  const ipCheck = await resolveAndCheckIp(url.hostname.replace(/^\[|\]$/g, ""));
  if (!ipCheck.ok) {
    return { ok: false, reason: ipCheck.reason, detail: ipCheck.detail };
  }
  return { ok: true, url, ip: ipCheck.ip };
}

/** Connect to the validated IP, preserving Host and TLS SNI. Bound the
 * actual stream and decompressed bytes, including chunked responses. */
function pinnedRead(url: URL, ip: string, init: RequestInit, signal: AbortSignal, maxBytes: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
    const method = (init.method ?? "GET").toUpperCase();
    const req = transport(url, {
      hostname: ip, servername: url.hostname.replace(/^\[|\]$/g, ""), agent: false, signal, method,
      headers: { ...Object.fromEntries(new Headers(init.headers)), host: url.host, "accept-encoding": "identity" },
    }, res => {
      let bytes = 0;
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > maxBytes) { reject(new Error("too_large")); req.destroy(); return; }
        chunks.push(chunk);
      });
      res.on("error", reject);
      res.on("end", () => {
        try {
          let body = Buffer.concat(chunks);
          const encoding = res.headers["content-encoding"];
          const limit = { maxOutputLength: maxBytes };
          if (encoding === "gzip") body = gunzipSync(body, limit);
          else if (encoding === "br") body = brotliDecompressSync(body, limit);
          else if (encoding === "deflate") body = inflateSync(body, limit);
          else if (encoding && encoding !== "identity") throw new Error("fetch_failed");
          const headers = new Headers();
          for (const [key, value] of Object.entries(res.headers)) if (value !== undefined && !["content-length", "content-encoding"].includes(key)) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
          const status = res.statusCode ?? 502;
          resolve(new Response(method === "HEAD" || [204,205,304].includes(status) ? null : new Uint8Array(body), {status, headers}));
        } catch (error) { reject((error as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE" ? new Error("too_large") : error); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// ---- Public entry point -----------------------------------------------------

/**
 * Fetch a public URL with DNS-pinned transport and bounded response reads.
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
  const signal = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(options.init?.signal ? [options.init.signal] : [])]);
  const init = { ...options.init, headers: new Headers(options.init?.headers) };
  if (!["GET", "HEAD"].includes((init.method ?? "GET").toUpperCase()) || init.body) return { ok: false, reason: "fetch_failed" };

  let currentUrl = rawUrl;
  let redirectsLeft = maxRedirects;
  let response: Response | null = null;

  while (true) {
    const validated = await Promise.race([validateUrl(currentUrl), new Promise<{ok:false;reason:"timeout"}>(resolve => {
      if (signal.aborted) resolve({ok:false,reason:"timeout"});
      else signal.addEventListener("abort", () => resolve({ok:false,reason:"timeout"}), {once:true});
    })]);
    if (!validated.ok) {
      return {
        ok: false,
        reason: validated.reason,
        detail: "detail" in validated ? validated.detail : undefined,
      };
    }

    try {
      response = await pinnedRead(validated.url, validated.ip, init, signal, options.maxBytes ?? 8 * 1024 * 1024);
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e.message === "too_large") return { ok: false, reason: "too_large" };
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
      if (validated.url.protocol === "https:" && nextUrl.protocol === "http:") return { ok: false, reason: "blocked_protocol" };
      if (nextUrl.origin !== validated.url.origin) for (const name of ["authorization", "cookie", "x-figma-token"]) init.headers.delete(name);
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
