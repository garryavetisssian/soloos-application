import { GoogleGenerativeAI } from "@google/generative-ai";

let cached: GoogleGenerativeAI | null = null;

export function getGemini() {
  if (!cached) {
    const key = process.env.GOOGLE_GEMINI_API_KEY;
    if (!key) throw new Error("GOOGLE_GEMINI_API_KEY is not set");
    cached = new GoogleGenerativeAI(key);
  }
  return cached;
}

export function hasGeminiKey() {
  return Boolean(process.env.GOOGLE_GEMINI_API_KEY);
}

// Free-tier, fast multimodal model.
// `gemini-1.5-flash` was deprecated by Google in Sep 2025 and is no longer
// served on `generateContent` — see https://ai.google.dev/gemini-api/docs/models
export const GEMINI_MODEL = "gemini-2.5-flash";

// Lighter fallback used when the primary returns 503 (overloaded) OR
// 429 (free-tier daily-quota exhausted). Same family / API contract,
// smaller capacity, separate per-model daily quota — that last bit is
// crucial because flash-lite's free-tier daily limit is much larger
// than flash's (so we keep summarising even after flash is burned for
// the day). If this also fails we surface a safe "AI is temporarily
// busy" message rather than the raw error.
export const GEMINI_FALLBACK_MODEL = "gemini-2.5-flash-lite";

/**
 * Should we retry with the fallback model? Triggers on:
 *   • 503 / "overloaded" — primary model is temporarily busy
 *   • 429 — usually a free-tier daily quota cap, which is per-model;
 *     flash-lite has a separate (much higher) quota
 *   • Any message that mentions "quota", "rate", "limit", "exceeded"
 *     in case the SDK surfaces it without a clean status code
 */
export function shouldRetryOnFallbackModel(e: {
  status?: number;
  message?: string;
}): boolean {
  if (e.status === 503 || e.status === 429) return true;
  return /overload|unavailable|service is busy|quota|rate.?limit|exceeded/i.test(
    e.message ?? "",
  );
}
