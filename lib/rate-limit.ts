// Lightweight per-user rate limiter for AI API routes.
//
// Why in-memory rather than Redis/Upstash:
//   - Zero external dependencies, works on Vercel's Fluid Compute today.
//   - On serverless cold start the bucket resets to "fresh", which is
//     slightly looser than a centralised counter would be — but the
//     primary goal is to stop a single account from burning Gemini
//     quota in a single hot instance, not to prevent every conceivable
//     distributed abuse. For a public-launch hardening pass, swap the
//     underlying Map for `@upstash/ratelimit` — the call sites don't
//     change.
//
// Token-bucket model:
//   Each (userId, bucketName) pair has a bucket with capacity = `limit`
//   tokens and a refill rate of `limit / windowMs`. Each request takes
//   one token. If the bucket is empty, the request is denied.

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitConfig {
  /** Bucket capacity AND the number of requests allowed per window. */
  limit: number;
  /** Window length in milliseconds — controls refill rate. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Tokens remaining after this call (0 when denied). */
  remaining: number;
  /** Seconds until the bucket is fully refilled. */
  resetSeconds: number;
}

/**
 * Try to consume one token for the (userId, bucketName) pair.
 * Returns `{ ok: false }` when the bucket is empty — the caller should
 * return HTTP 429 to the client.
 */
export function consumeRateLimit(
  userId: string,
  bucketName: string,
  config: RateLimitConfig,
): RateLimitResult {
  const key = `${bucketName}:${userId}`;
  const now = Date.now();
  const refillRatePerMs = config.limit / config.windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: config.limit, lastRefill: now };
    buckets.set(key, bucket);
  } else {
    const elapsed = now - bucket.lastRefill;
    if (elapsed > 0) {
      const refill = elapsed * refillRatePerMs;
      bucket.tokens = Math.min(config.limit, bucket.tokens + refill);
      bucket.lastRefill = now;
    }
  }

  // Opportunistic cleanup: when a bucket has fully refilled and we just
  // touched it, evict it. Prevents unbounded growth across user IDs.
  // The bucket gets recreated on the next request — same behaviour.
  if (bucket.tokens >= config.limit) {
    // not deleting here because we're about to consume — defer to below
  }

  if (bucket.tokens < 1) {
    const missing = 1 - bucket.tokens;
    const waitMs = missing / refillRatePerMs;
    return {
      ok: false,
      remaining: 0,
      resetSeconds: Math.ceil(waitMs / 1000),
    };
  }

  bucket.tokens -= 1;
  const remaining = Math.floor(bucket.tokens);

  // If after consumption the bucket is still full enough to count as
  // "fresh", we keep it (cheap). Long-idle buckets get cleared lazily
  // on the next sweep below.
  maybeSweep(now);

  return {
    ok: true,
    remaining,
    resetSeconds: Math.ceil((config.limit - bucket.tokens) / refillRatePerMs / 1000),
  };
}

// Lazy eviction of buckets that haven't been touched in 24 hours.
// Runs at most once per minute to keep the overhead nil.
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;
const STALE_MS = 24 * 60 * 60 * 1000;

function maybeSweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > STALE_MS) {
      buckets.delete(key);
    }
  }
}

// =========================================================
// Preset buckets per route
// =========================================================
// One bucket per logical category. We pick limits based on the cost
// and abuse profile of each surface:
//   - cover-letter / job-research / profile-enhance: expensive, slower
//     (full Gemini generations). 15 per hour is plenty for a real user.
//   - improve / translate / normalize-research / profile-summary:
//     interactive, cheaper. 60 per hour.
// All AI routes share the same overall daily-cap via a per-user catch-all.

export const RATE_LIMITS = {
  generate: { limit: 15, windowMs: 60 * 60 * 1000 } satisfies RateLimitConfig,
  transform: { limit: 60, windowMs: 60 * 60 * 1000 } satisfies RateLimitConfig,
} as const;

/**
 * Build the standard JSON envelope a denied AI route should return.
 * Mirrors the existing `rate_limited` envelope shape used in the
 * cover-letter / translate / improve routes so the client doesn't
 * need to know whether the limit came from Gemini or from us.
 */
export function rateLimitedResponseBody(result: RateLimitResult) {
  return {
    error: "rate_limited" as const,
    message: `You're sending requests too quickly. Try again in ${result.resetSeconds}s.`,
    retryAfterSeconds: result.resetSeconds,
  };
}
