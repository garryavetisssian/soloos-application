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
import { detectJobLanguage } from "@/lib/language-detect";
import { profileToCandidateContext } from "@/lib/profile";
import {
  consumeRateLimit,
  RATE_LIMITS,
  rateLimitedResponseBody,
} from "@/lib/rate-limit";
import {
  COVER_LETTER_MIN_COMPLETENESS,
  computeCompleteness,
  formStateFromRow,
} from "@/lib/profile-form";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/lib/types";
import { scoreLink } from "@/lib/work-links/quality";
import type { WorkLinkRow } from "@/lib/work-links/types";

// =============================================================
// Gemini error → safe response shape.
// We never forward the raw upstream message: it contains URLs, model paths
// and stack-trace-ish text. The status code drives the mapping; everything
// technical stays in the server log.
// =============================================================

type AiErrorCode = "ai_unavailable" | "rate_limited" | "ai_failed";

function isOverloaded(e: { status?: number; message?: string }): boolean {
  return (
    e.status === 503 ||
    /overload|unavailable|service is busy/i.test(e.message ?? "")
  );
}

function normalizeAiError(e: { status?: number; message?: string }): {
  error: AiErrorCode;
  message: string;
} {
  if (isOverloaded(e)) {
    return {
      error: "ai_unavailable",
      message: "AI is temporarily busy. Please try again in a moment.",
    };
  }
  const status = e.status ?? 0;
  if (status === 429 || /rate|quota/i.test(e.message ?? "")) {
    return {
      error: "rate_limited",
      message: "Too many requests. Please wait a moment and try again.",
    };
  }
  return {
    error: "ai_failed",
    message: "We couldn't generate the cover letter. Please try again.",
  };
}

function aiErrorHttpStatus(code: AiErrorCode): number {
  switch (code) {
    case "ai_unavailable":
      return 503;
    case "rate_limited":
      return 429;
    case "ai_failed":
    default:
      return 502;
  }
}

// Try the primary model. On 503 (overloaded), retry once with the fallback
// model. Any other error rethrows immediately. Returns the trimmed response
// text; the caller still has to validate emptiness.
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
    console.warn("[cover-letter] primary model unavailable — falling back", {
      primary: GEMINI_MODEL,
      fallback: GEMINI_FALLBACK_MODEL,
      status: e.status,
      message: e.message,
    });
    return await tryOnce(GEMINI_FALLBACK_MODEL);
  }
}

const Body = z.object({
  jobDescription: z.string().min(1).max(8000),
  // Optional explicit output language. When the client sends this, it
  // overrides the server-side detection from the job description text.
  // Used by the cover-letters page when the user picks an Output language
  // different from the detected job-posting language.
  targetLanguage: z.enum(["English", "Russian", "Armenian"]).optional(),
  // Where the letter is going. "platform" = vacancy site / formal cover
  // letter (default, current behaviour). "direct" = LinkedIn DM, email,
  // Telegram — the prompt switches to a much shorter, more conversational
  // register and addresses the recipient by first name when known.
  channel: z.enum(["platform", "direct"]).optional(),
  // Explicit recipient name supplied by the user (e.g. they know the
  // recruiter from LinkedIn). Wins over jobResearch.recruiter_name.
  recipientName: z.string().max(200).optional(),
  // Optional structured research from /api/ai/job-research. When present,
  // the cover-letter prompt weaves one or two specific company/product
  // details into the letter naturally. The shape is permissive — every
  // field is optional so older / partial research objects still validate.
  jobResearch: z
    .object({
      url: z.string().optional(),
      company_name: z.string().optional(),
      job_title: z.string().optional(),
      job_summary: z.string().optional(),
      responsibilities: z.string().optional(),
      requirements: z.string().optional(),
      company_context: z.string().optional(),
      product_context: z.string().optional(),
      tone: z.string().optional(),
      useful_signals: z.array(z.string()).optional(),
      recruiter_name: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Rate-limit AFTER auth so anonymous probes don't burn anyone's
  // bucket. Generate routes share the cheaper `generate` budget.
  const rl = consumeRateLimit(user.id, "generate", RATE_LIMITS.generate);
  if (!rl.ok) {
    return NextResponse.json(rateLimitedResponseBody(rl), {
      status: 429,
      headers: { "retry-after": String(rl.resetSeconds) },
    });
  }

  if (!hasGeminiKey()) {
    console.error("[cover-letter] GOOGLE_GEMINI_API_KEY is not set");
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
          parsed.error.issues[0]?.message ?? "Job description is required.",
      },
      { status: 400 },
    );
  }
  const {
    jobDescription,
    jobResearch,
    targetLanguage: clientLanguage,
    channel,
    recipientName,
  } = parsed.data;

  // Load the saved career profile server-side. The browser never sends it,
  // so it can't be tampered with and stays consistent with what the user saved.
  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profileRow) {
    return NextResponse.json(
      {
        error: "profile_required",
        message: "Complete your career profile before generating cover letters.",
      },
      { status: 412 },
    );
  }
  const profile = profileRow as UserProfile;
  const completeness = computeCompleteness(formStateFromRow(profile));
  if (completeness < COVER_LETTER_MIN_COMPLETENESS) {
    return NextResponse.json(
      {
        error: "profile_incomplete",
        message: `Cover letter generation requires a profile that's at least ${COVER_LETTER_MIN_COMPLETENESS}% complete. Yours is ${completeness}%. Open Settings → Career profile to add more detail.`,
        completeness,
        threshold: COVER_LETTER_MIN_COMPLETENESS,
      },
      { status: 412 },
    );
  }
  const candidateProfile = profileToCandidateContext(profile);
  if (!candidateProfile.trim()) {
    return NextResponse.json(
      {
        error: "profile_empty",
        message: "Your saved profile is empty. Add details in Settings → Profile.",
      },
      { status: 412 },
    );
  }

  // Output language: explicit client choice wins; otherwise auto-detect
  // from the job description text. This lets a Russian-speaking user ask
  // for an English letter even though the JD is in Russian.
  const targetLanguage = clientLanguage ?? detectJobLanguage(jobDescription);

  // Portfolio links: load the user's eligible-and-ready links so the
  // prompt can weave one or two into the letter when relevant. We
  // additionally filter out links whose computed quality score is
  // below LINK_USAGE_THRESHOLD — a link with messy data (frames named
  // "Frame 145", placeholder text) would feed garbage into the
  // cover-letter prompt and produce incorrect claims. The toggle
  // alone isn't enough; the data has to actually be usable.
  const { data: portfolioRows } = await supabase
    .from("work_links")
    .select(
      "id, user_id, url, type, title, summary, cover_letter_hint, thumbnail_url, status, use_in_cover_letter, quality_signals, last_checked_at, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .eq("status", "ready")
    .eq("use_in_cover_letter", true)
    .order("created_at", { ascending: false })
    .limit(20);
  const portfolioLinks = ((portfolioRows ?? []) as WorkLinkRow[])
    .filter((row) => !scoreLink(row).blocked)
    .slice(0, 6)
    .map((row) => ({
      url: row.url,
      type: row.type,
      title: row.title,
      summary: row.summary,
      cover_letter_hint: row.cover_letter_hint,
    }));

  const prompt = PROMPTS.coverLetter(
    candidateProfile,
    jobDescription,
    targetLanguage,
    jobResearch ?? null,
    channel ?? "platform",
    recipientName ?? null,
    portfolioLinks,
  );

  let text: string;
  try {
    text = await generateWithFallback(prompt);
  } catch (err) {
    const e = err as {
      message?: string;
      status?: number;
      statusText?: string;
      errorDetails?: unknown;
      stack?: string;
    };
    // Verbose log on the server only — useful for diagnosis. The client
    // never sees this object.
    console.error("[cover-letter] Gemini error after fallback", {
      primaryModel: GEMINI_MODEL,
      fallbackModel: GEMINI_FALLBACK_MODEL,
      status: e.status,
      statusText: e.statusText,
      message: e.message,
      errorDetails: e.errorDetails,
      stack: e.stack,
    });
    const normalized = normalizeAiError(e);
    return NextResponse.json(normalized, {
      status: aiErrorHttpStatus(normalized.error),
    });
  }

  if (!text) {
    console.error("[cover-letter] empty response from", GEMINI_MODEL);
    return NextResponse.json(
      {
        error: "empty_response",
        message:
          "AI returned an empty response — this often means the prompt was blocked by a safety filter. Try rephrasing.",
      },
      { status: 502 },
    );
  }

  const { error: insertError } = await supabase.from("cover_letters").insert({
    user_id: user.id,
    job_description: jobDescription,
    generated_text: text,
  });
  if (insertError) {
    console.error("[cover-letter] persist failed:", insertError);
  }

  return NextResponse.json({ text, language: targetLanguage });
}
