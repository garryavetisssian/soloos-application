import { NextResponse } from "next/server";
import { z } from "zod";
import {
  GEMINI_FALLBACK_MODEL,
  GEMINI_MODEL,
  getGemini,
  hasGeminiKey,
  shouldRetryOnFallbackModel,
} from "@/lib/gemini/client";
import { PROMPTS } from "@/lib/gemini/prompts";
import {
  consumeRateLimit,
  RATE_LIMITS,
  rateLimitedResponseBody,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

// Translate an arbitrary block of text (currently a generated cover letter)
// into a target output language while preserving names, URLs, and other
// proper nouns. Distinct from /api/ai/normalize-research, which translates
// the structured job-context object — this one operates on plain prose and
// is invoked from the "Translate" dropdown on the generated-letter card.
//
// We never expose raw Gemini errors to the client; the verbose log stays
// server-side, the response is one of a small set of stable error codes.

const Body = z.object({
  text: z.string().min(1).max(20000),
  targetLanguage: z.enum(["English", "Russian", "Armenian"]),
  // Caller-supplied terms to keep verbatim — typically company / product
  // names lifted from the analyzed job page. The route adds the user's
  // own profile fields (name, email, URLs) on top, so the client doesn't
  // have to redundantly pass them across the wire.
  preserveTerms: z.array(z.string().min(1).max(120)).max(50).optional(),
});

function isOverloaded(e: { status?: number; message?: string }): boolean {
  return (
    e.status === 503 ||
    /overload|unavailable|service is busy/i.test(e.message ?? "")
  );
}

async function generateWithFallback(prompt: string): Promise<string> {
  const tryOnce = async (modelName: string) => {
    const model = getGemini().getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  };
  try {
    return await tryOnce(GEMINI_MODEL);
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (!shouldRetryOnFallbackModel(e)) throw err;
    console.warn("[translate] primary model unavailable — falling back", {
      primary: GEMINI_MODEL,
      fallback: GEMINI_FALLBACK_MODEL,
      status: e.status,
    });
    return await tryOnce(GEMINI_FALLBACK_MODEL);
  }
}

// Build the union of caller-provided preserve terms and the user's own
// profile fields. Deduped, trimmed, capped — Gemini doesn't need 200
// repeats. We intentionally keep `linkedin_url` / `portfolio_url` whole
// (URL-shaped) so the prompt won't try to translate the path either.
function buildPreserveTerms(
  fromClient: string[] | undefined,
  profile: UserProfile,
): string[] {
  const collected: string[] = [];
  const push = (v: string | null | undefined) => {
    if (!v) return;
    const trimmed = v.trim();
    if (trimmed) collected.push(trimmed);
  };
  push(profile.full_name);
  push(profile.email);
  push(profile.linkedin_url);
  push(profile.portfolio_url);
  for (const t of fromClient ?? []) push(t);
  // Dedupe case-insensitively, keeping first occurrence to preserve order.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of collected) {
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
  }
  return out.slice(0, 50);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rl = consumeRateLimit(user.id, "transform", RATE_LIMITS.transform);
  if (!rl.ok) {
    return NextResponse.json(rateLimitedResponseBody(rl), {
      status: 429,
      headers: { "retry-after": String(rl.resetSeconds) },
    });
  }
  if (!hasGeminiKey()) {
    console.error("[translate] GOOGLE_GEMINI_API_KEY is not set");
    return NextResponse.json(
      { error: "server_misconfigured", message: "AI is not configured." },
      { status: 500 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_body",
        message:
          parsed.error.issues[0]?.message ??
          "Provide text and targetLanguage.",
      },
      { status: 400 },
    );
  }
  const { text, targetLanguage, preserveTerms } = parsed.data;

  // Pull the profile so we can pin the candidate's own name / contact info.
  // Best-effort: if the profile row is missing we still translate, just
  // without the candidate-specific guarantees (the prompt still pins URLs
  // and product / company names by category).
  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("full_name,email,linkedin_url,portfolio_url")
    .eq("user_id", user.id)
    .maybeSingle();
  const preserve = buildPreserveTerms(
    preserveTerms,
    (profileRow ?? {
      full_name: null,
      email: null,
      linkedin_url: null,
      portfolio_url: null,
    }) as UserProfile,
  );

  const prompt = PROMPTS.translateLetter(text, targetLanguage, preserve);

  let translatedText: string;
  try {
    translatedText = await generateWithFallback(prompt);
  } catch (err) {
    const e = err as {
      message?: string;
      status?: number;
      statusText?: string;
    };
    console.error("[translate] Gemini error after fallback", {
      status: e.status,
      statusText: e.statusText,
    });
    if (isOverloaded(e)) {
      return NextResponse.json(
        {
          error: "ai_unavailable",
          message: "AI is temporarily busy. Please try again in a moment.",
        },
        { status: 503 },
      );
    }
    if (e.status === 429 || /rate|quota/i.test(e.message ?? "")) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message: "Too many requests. Please wait a moment.",
        },
        { status: 429 },
      );
    }
    return NextResponse.json(
      {
        error: "ai_failed",
        message: "We couldn't translate the letter. Please try again.",
      },
      { status: 502 },
    );
  }

  if (!translatedText) {
    console.error("[translate] empty response from Gemini");
    return NextResponse.json(
      {
        error: "empty_response",
        message: "AI returned an empty response. Please try again.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ translatedText, targetLanguage });
}
