import { NextResponse } from "next/server";
import { z } from "zod";
import { hasGeminiKey } from "@/lib/gemini/client";
import { normalizeJobResearch } from "@/lib/i18n/normalize";
import type { JobResearch } from "@/lib/job-research/types";
import {
  consumeRateLimit,
  RATE_LIMITS,
  rateLimitedResponseBody,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// Re-normalize an existing JobResearch object into a different output
// language without re-fetching the source page. Used by the cover-letters
// page when the user switches output language after a successful analysis,
// so we never leave stale mixed-language research visible.

const Lang = z.enum(["English", "Russian", "Armenian"]);

const ResearchInput = z.object({
  url: z.string(),
  is_job_page: z.boolean(),
  company_name: z.string(),
  job_title: z.string(),
  job_summary: z.string(),
  responsibilities: z.string(),
  requirements: z.string(),
  company_context: z.string(),
  product_context: z.string(),
  tone: z.string(),
  useful_signals: z.array(z.string()),
  // recruiter_name is optional for back-compat with letters/research
  // objects produced before the field existed. Defaults to empty so the
  // normalize step doesn't break on older saved blobs.
  recruiter_name: z.string().default(""),
  raw_excerpt: z.string(),
  source_language: Lang,
  output_language: Lang,
});

const Body = z.object({
  research: ResearchInput,
  targetLanguage: Lang,
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
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
    console.error("[normalize-research] GOOGLE_GEMINI_API_KEY is not set");
    return NextResponse.json(
      { error: "server_misconfigured", message: "AI is not configured." },
      { status: 500 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", message: "Provide research and targetLanguage." },
      { status: 400 },
    );
  }

  // Fast-path: already in target language → no AI call.
  if (parsed.data.research.output_language === parsed.data.targetLanguage) {
    return NextResponse.json({ research: parsed.data.research });
  }

  try {
    const normalized = await normalizeJobResearch(
      parsed.data.research as JobResearch,
      parsed.data.targetLanguage,
    );
    return NextResponse.json({ research: normalized });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    console.error("[normalize-research] Gemini error", {
      status: e.status,
    });
    const overloaded =
      e.status === 503 ||
      /overload|unavailable|service is busy/i.test(e.message ?? "");
    if (overloaded) {
      return NextResponse.json(
        { error: "ai_unavailable", message: "AI is temporarily busy." },
        { status: 503 },
      );
    }
    if (e.status === 429 || /rate|quota/i.test(e.message ?? "")) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many requests." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "ai_failed", message: "Couldn't translate this job context." },
      { status: 502 },
    );
  }
}
