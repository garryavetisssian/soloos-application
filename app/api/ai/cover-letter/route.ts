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
import { loadEligibleCoverLetterLinks } from "@/lib/work-links/eligible";

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

// JSON-mode variant for the screening-answers step (structured output).
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

// Cheap gate so we only spend an AI call on jobs that plausibly contain
// screening / application questions. The prompt itself returns an empty
// array for false positives, so this can be permissive.
function looksLikeScreeningQuestions(text: string): boolean {
  if (!text) return false;
  const hasQuestionMark = text.includes("?");
  const numbered = /(^|\n)\s*\d+[.)]\s+\S/.test(text);
  const cues =
    /(answer the following|answer these|in your proposal|please answer|screening question|cover the following|why do you|why are you|tell us|describe your|what makes you|расскаж|ответьте|опишите|почему вы|why should we)/i.test(
      text,
    );
  return (hasQuestionMark && cues) || (cues && numbered) || (hasQuestionMark && numbered);
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
  // Explicit link selection from the UI multiselect. When present (even an
  // empty array), the letter includes EXACTLY these link URLs and no others
  // — the profile Portfolio URL is included only if it appears here. When
  // omitted, links are AI-relevance-gated (auto) and never forced.
  includeLinkUrls: z.array(z.string()).max(20).optional(),
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
    includeLinkUrls,
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

  // Portfolio links: load the user's eligible-and-ready links (quality-gated;
  // the toggle alone isn't enough — the data has to be usable).
  const eligibleLinks = await loadEligibleCoverLetterLinks(supabase, user.id);

  // Link policy. When the client sent an explicit selection (multiselect),
  // the letter uses EXACTLY those URLs: project links are filtered to the
  // selection, and the profile Portfolio URL is included only if it's in the
  // set. Otherwise it's "auto" — the prompt includes links only when they
  // genuinely fit the role, and never force-adds an irrelevant one.
  const profilePortfolioUrl = (profile.portfolio_url ?? "").trim();
  let portfolioLinks = eligibleLinks;
  let linkPolicy:
    | { mode: "auto" }
    | { mode: "explicit"; includeProfilePortfolio: boolean } = {
    mode: "auto",
  };
  if (includeLinkUrls) {
    const selected = new Set(includeLinkUrls);
    portfolioLinks = eligibleLinks.filter((l) => selected.has(l.url));
    linkPolicy = {
      mode: "explicit",
      includeProfilePortfolio:
        profilePortfolioUrl.length > 0 && selected.has(profilePortfolioUrl),
    };
  }

  const prompt = PROMPTS.coverLetter(
    candidateProfile,
    jobDescription,
    targetLanguage,
    jobResearch ?? null,
    channel ?? "platform",
    recipientName ?? null,
    portfolioLinks,
    linkPolicy,
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

  // Humanize pass — a standard part of every generation. Rewrites the draft
  // so it reads like a real person wrote it (varied rhythm, contractions,
  // fewer AI tells) while keeping every fact, name, URL, and link verbatim.
  // Falls back to the draft if the pass fails, so generation never breaks.
  let finalText = text;
  try {
    const humanized = await generateWithFallback(
      PROMPTS.humanize(text, targetLanguage, channel ?? "platform"),
    );
    if (humanized && humanized.trim()) finalText = humanized.trim();
  } catch (err) {
    console.warn("[cover-letter] humanize pass failed; using draft", err);
  }

  // Screening / application questions (e.g. Upwork proposal questions). When
  // the job text plausibly contains them, extract each and answer it grounded
  // in the profile. Returned alongside the letter; the UI shows them below it
  // and lets the user merge them in. Failures degrade to no answers.
  let screeningAnswers: Array<{ question: string; answer: string }> = [];
  if (looksLikeScreeningQuestions(jobDescription)) {
    try {
      const raw = await generateJsonWithFallback(
        PROMPTS.screeningAnswers(jobDescription, candidateProfile, targetLanguage),
      );
      const parsed = JSON.parse(raw) as {
        answers?: Array<{ question?: unknown; answer?: unknown }>;
      };
      screeningAnswers = (parsed.answers ?? [])
        .map((a) => ({
          question: String(a.question ?? "").trim(),
          answer: String(a.answer ?? "").trim(),
        }))
        .filter((a) => a.question && a.answer)
        .slice(0, 12);
    } catch (err) {
      console.warn("[cover-letter] screening answers failed", err);
    }
  }

  const { error: insertError } = await supabase.from("cover_letters").insert({
    user_id: user.id,
    job_description: jobDescription,
    generated_text: finalText,
  });
  if (insertError) {
    console.error("[cover-letter] persist failed:", insertError);
  }

  return NextResponse.json({
    text: finalText,
    language: targetLanguage,
    answers: screeningAnswers,
  });
}
