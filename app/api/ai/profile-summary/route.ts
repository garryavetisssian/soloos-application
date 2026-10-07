import { NextResponse } from "next/server";
import { z } from "zod";
import { GEMINI_MODEL, getGemini, hasGeminiKey } from "@/lib/gemini/client";
import { PROMPTS } from "@/lib/gemini/prompts";
import {
  consumeRateLimit,
  RATE_LIMITS,
  rateLimitedResponseBody,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({
  current_role: z.string().max(200).default(""),
  years_of_experience: z.string().max(20).default(""),
  skills: z.string().max(2000).default(""),
  tools: z.string().max(2000).default(""),
  target_role: z.string().max(200).default(""),
});

const SUMMARY_MAX = 1400;

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
        message: parsed.error.issues[0]?.message ?? "Invalid request.",
      },
      { status: 400 },
    );
  }

  // Don't generate from nothing — require at least a current_role or skills.
  if (!parsed.data.current_role && !parsed.data.skills) {
    return NextResponse.json(
      {
        error: "insufficient_input",
        message:
          "Add a current role or some skills first so the summary has something to work from.",
      },
      { status: 400 },
    );
  }

  let summary: string;
  try {
    const model = getGemini().getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(
      PROMPTS.profileSummary(parsed.data),
    );
    summary = result.response.text().trim().replace(/^["']|["']$/g, "");
  } catch (err) {
    const e = err as { message?: string; status?: number };
    console.error("[profile-summary] Gemini error", { status: e.status });
    return NextResponse.json(
      {
        error: "ai_failed",
        message: "AI summary failed. Please try again.",
        upstreamStatus: e.status ?? null,
      },
      { status: 502 },
    );
  }

  if (summary.length > SUMMARY_MAX) {
    summary = summary.slice(0, SUMMARY_MAX).trim();
  }

  return NextResponse.json({ summary });
}
