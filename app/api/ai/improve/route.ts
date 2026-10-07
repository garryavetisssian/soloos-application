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

const Body = z.object({
  text: z.string().min(1).max(8000),
  mode: z.enum(["improve", "shorten", "expand"]),
  // Optional tone steer (only meaningful when mode === "improve"). Drives
  // the cover letters page's "More" dropdown ("Make more confident",
  // "Make more friendly", "Make more formal", "Adapt for startup tone").
  tone: z.enum(["confident", "friendly", "formal", "startup"]).optional(),
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
    return result.response.text();
  };
  try {
    return await tryOnce(GEMINI_MODEL);
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (!shouldRetryOnFallbackModel(e)) throw err;
    console.warn("[improve] primary model unavailable — falling back", {
      primary: GEMINI_MODEL,
      fallback: GEMINI_FALLBACK_MODEL,
      status: e.status,
    });
    return await tryOnce(GEMINI_FALLBACK_MODEL);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rl = consumeRateLimit(user.id, "transform", RATE_LIMITS.transform);
  if (!rl.ok) {
    return NextResponse.json(rateLimitedResponseBody(rl), {
      status: 429,
      headers: { "retry-after": String(rl.resetSeconds) },
    });
  }

  if (!hasGeminiKey()) {
    console.error("[improve] GOOGLE_GEMINI_API_KEY is not set");
    return NextResponse.json(
      { error: "server_misconfigured", message: "AI is not configured." },
      { status: 500 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { text, mode, tone } = parsed.data;
  const prompt =
    mode === "improve" ? PROMPTS.improve(text, tone) : PROMPTS[mode](text);

  let output: string;
  try {
    output = await generateWithFallback(prompt);
  } catch (err) {
    const e = err as {
      message?: string;
      status?: number;
      statusText?: string;
    };
    // Verbose server log; the client only ever sees the normalized envelope.
    console.error("[improve] Gemini error after fallback", {
      mode,
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
        message: "We couldn't process that text. Please try again.",
      },
      { status: 502 },
    );
  }

  if (!output) {
    console.error("[improve] empty response from Gemini");
    return NextResponse.json(
      {
        error: "empty_response",
        message: "AI returned an empty response. Please try again.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ text: output });
}
