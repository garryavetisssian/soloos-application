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
import { profileToCandidateContext } from "@/lib/profile";
import {
  consumeRateLimit,
  RATE_LIMITS,
  rateLimitedResponseBody,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  // The questions the user pasted (already split into individual entries).
  questions: z.array(z.string().trim().min(1)).min(1).max(20),
  // Optional job context so answers are tailored to the specific vacancy.
  jobDescription: z.string().max(8000).optional(),
  targetLanguage: z.enum(["English", "Russian", "Armenian"]).optional(),
});

async function generateJsonWithFallback(prompt: string): Promise<string> {
  const tryOnce = async (modelName: string) => {
    const model = getGemini().getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  };
  try {
    return await tryOnce(GEMINI_MODEL);
  } catch (err) {
    if (!shouldRetryOnFallbackModel(err as { status?: number })) throw err;
    return await tryOnce(GEMINI_FALLBACK_MODEL);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = consumeRateLimit(user.id, "generate", RATE_LIMITS.generate);
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

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", message: "Provide at least one question." },
      { status: 400 },
    );
  }

  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profileRow) {
    return NextResponse.json(
      {
        error: "profile_required",
        message: "Complete your career profile before answering questions.",
      },
      { status: 412 },
    );
  }
  const candidateProfile = profileToCandidateContext(profileRow as UserProfile);

  const prompt = PROMPTS.screeningAnswers(
    parsed.data.jobDescription ?? "",
    candidateProfile,
    parsed.data.targetLanguage ?? "English",
    parsed.data.questions,
  );

  let raw: string;
  try {
    raw = await generateJsonWithFallback(prompt);
  } catch (err) {
    console.error("[screening-answers] Gemini error after fallback", err);
    return NextResponse.json(
      {
        error: "ai_failed",
        message: "We couldn't answer these questions right now. Try again.",
      },
      { status: 502 },
    );
  }

  let answers: Array<{ question: string; answer: string }> = [];
  try {
    const out = JSON.parse(raw) as {
      answers?: Array<{ question?: unknown; answer?: unknown }>;
    };
    answers = (out.answers ?? [])
      .map((a) => ({
        question: String(a.question ?? "").trim(),
        answer: String(a.answer ?? "").trim(),
      }))
      .filter((a) => a.question && a.answer)
      .slice(0, 20);
  } catch (err) {
    console.error("[screening-answers] JSON parse failed", { raw, err });
    return NextResponse.json(
      { error: "invalid_ai_response", message: "Try again in a moment." },
      { status: 502 },
    );
  }

  return NextResponse.json({ answers });
}
