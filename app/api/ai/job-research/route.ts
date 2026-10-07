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
import type { ExtractFailureReason } from "@/lib/html-extract";
import { detectDominantLanguage } from "@/lib/i18n/normalize";
import type { OutputLanguage } from "@/lib/i18n/types";
import { extractJob } from "@/lib/job-research/extract";
import type { JobResearch } from "@/lib/job-research/types";
import {
  consumeRateLimit,
  RATE_LIMITS,
  rateLimitedResponseBody,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  url: z.string().min(1).max(2048),
  // Output language for every user-facing field on the returned JobResearch.
  // The extractor emits its result directly in this language, so the UI
  // never has to handle mixed-language source pages.
  targetLanguage: z.enum(["English", "Russian", "Armenian"]).optional(),
});

const Output = z.object({
  is_job_page: z.boolean(),
  company_name: z.string().default(""),
  job_title: z.string().default(""),
  job_summary: z.string().default(""),
  responsibilities: z.string().default(""),
  requirements: z.string().default(""),
  company_context: z.string().default(""),
  product_context: z.string().default(""),
  tone: z.string().default(""),
  useful_signals: z.array(z.string()).default([]),
  recruiter_name: z.string().default(""),
});

// User-facing copy per extraction failure. Technical detail goes to the log.
const FAILURE_COPY: Record<
  ExtractFailureReason,
  { message: string; subtext: string; httpStatus: number }
> = {
  invalid_url: {
    message: "That doesn't look like a valid URL.",
    subtext: "Paste a public job page link starting with http:// or https://.",
    httpStatus: 400,
  },
  internal_url: {
    message: "We can't fetch internal URLs.",
    subtext: "Use a public job posting link.",
    httpStatus: 400,
  },
  blocked: {
    message: "This page blocks automatic reading.",
    subtext:
      "You can paste the description manually instead, or try another link.",
    httpStatus: 422,
  },
  not_found: {
    message: "We couldn't find this job page.",
    subtext: "Make sure the link is still active.",
    httpStatus: 422,
  },
  timeout: {
    message: "The page took too long to respond.",
    subtext: "Try again, or paste the description manually.",
    httpStatus: 422,
  },
  low_content: {
    message: "We couldn't find enough job details on this page.",
    subtext:
      "Try the direct job posting URL, or paste the description manually.",
    httpStatus: 422,
  },
  js_required: {
    // Surfaced specifically for sites like hh.ru that only render
    // content via JavaScript and serve a "please enable JS" stub to
    // automated readers. The route augments this message with a
    // hostname-specific note when it knows the site.
    message: "This site only loads its content in a real browser.",
    subtext:
      "Copy the job description from the page and paste it manually — we'll generate the letter from that.",
    httpStatus: 422,
  },
  fetch_failed: {
    message: "We couldn't read this job page automatically.",
    subtext: "You can paste the job description manually instead.",
    httpStatus: 422,
  },
};

// Hostname-specific overrides for js_required so users hitting a
// well-known platform get a concrete next step instead of generic
// advice. Add entries as we discover more anti-bot sites.
function hostnameSpecificJsRequiredCopy(
  hostname: string,
): { message: string; subtext: string } | null {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  if (h === "hh.ru" || h.endsWith(".hh.ru") || h === "hh.kz") {
    return {
      message: "hh.ru blocks automated readers.",
      subtext:
        "Copy the job description from the hh.ru page and paste it manually — the letter will still be generated from your profile + the description.",
    };
  }
  if (h === "linkedin.com" || h.endsWith(".linkedin.com")) {
    return {
      message: "LinkedIn requires sign-in to read job pages.",
      subtext:
        "Copy the job description from LinkedIn and paste it manually here.",
    };
  }
  return null;
}

// Run Gemini with the same primary → fallback retry as the cover-letter route.
async function generateWithFallback(prompt: string): Promise<string> {
  const tryOnce = async (modelName: string) => {
    const model = getGemini().getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  };
  try {
    return await tryOnce(GEMINI_MODEL);
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (!shouldRetryOnFallbackModel(e)) throw err;
    console.warn("[job-research] primary unavailable — falling back", {
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
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
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
    console.error("[job-research] GOOGLE_GEMINI_API_KEY is not set");
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
        message: "Provide a job page URL.",
      },
      { status: 400 },
    );
  }

  // ---- 1. Fetch + extract ----
  // The orchestrator tries, in order: a platform adapter (public JSON APIs
  // for hh.ru / Greenhouse / Lever / …), then a generic page read
  // (schema.org JobPosting JSON-LD, preferred, else cleaned body text),
  // then a Vision read of the page's preview image for JS-only / stub
  // pages. All paths return the same ExtractResult shape.
  const extraction = await extractJob(parsed.data.url);
  if (!extraction.ok) {
    console.warn("[job-research] extraction failed", {
      url: parsed.data.url,
      reason: extraction.reason,
      httpStatus: extraction.httpStatus,
      detail: extraction.detail,
    });
    const copy = FAILURE_COPY[extraction.reason];
    // For "js_required", upgrade to hostname-specific copy when we
    // recognise the site — e.g. hh.ru / LinkedIn.
    let message = copy.message;
    let subtext = copy.subtext;
    if (extraction.reason === "js_required") {
      try {
        const host = new URL(parsed.data.url).hostname;
        const specific = hostnameSpecificJsRequiredCopy(host);
        if (specific) {
          message = specific.message;
          subtext = specific.subtext;
        }
      } catch {
        // ignore — fall back to generic message
      }
    }
    return NextResponse.json(
      {
        error: extraction.reason,
        message,
        subtext,
      },
      { status: copy.httpStatus },
    );
  }

  // Resolve the target language. Explicit client choice wins; otherwise
  // we fall back to the page's detected dominant language so the very
  // first analyze emits research in the source language (no follow-up
  // normalize-research call needed). The client only sends
  // targetLanguage when the user has overridden the output dropdown.
  const targetLanguage: OutputLanguage =
    parsed.data.targetLanguage ?? detectDominantLanguage(extraction.text);

  // ---- 2. Gemini structured analysis (single-pass, language-aware) ----
  // The prompt instructs Gemini to emit every user-facing field directly
  // in `targetLanguage`, so we never have to translate twice.
  let raw: string;
  try {
    raw = await generateWithFallback(
      PROMPTS.jobResearch(extraction.url, extraction.text, targetLanguage),
    );
  } catch (err) {
    const e = err as {
      status?: number;
      statusText?: string;
      message?: string;
      errorDetails?: unknown;
    };
    console.error("[job-research] Gemini error after fallback", {
      url: parsed.data.url,
      primary: GEMINI_MODEL,
      fallback: GEMINI_FALLBACK_MODEL,
      status: e.status,
      statusText: e.statusText,
    });
    return NextResponse.json(
      {
        error: "ai_failed",
        message: "We couldn't analyze this job page right now.",
        subtext: "Please try again in a moment, or paste the description manually.",
      },
      { status: 502 },
    );
  }

  let parsedOutput;
  try {
    parsedOutput = Output.parse(JSON.parse(raw));
  } catch (err) {
    console.error("[job-research] JSON parse failed", {
      url: parsed.data.url,
      name: (err as Error).name,
    });
    return NextResponse.json(
      {
        error: "invalid_ai_response",
        message: "We couldn't structure the job details from this page.",
        subtext: "Try again, or paste the description manually.",
      },
      { status: 502 },
    );
  }

  if (!parsedOutput.is_job_page) {
    console.info("[job-research] not a job page", {
      url: parsed.data.url,
    });
    return NextResponse.json(
      {
        error: "not_a_job_page",
        message: "This doesn't look like a job posting.",
        subtext:
          "Paste a direct link to a job posting, or paste the description manually.",
      },
      { status: 422 },
    );
  }

  const research: JobResearch = {
    url: extraction.url,
    is_job_page: true,
    company_name: parsedOutput.company_name,
    job_title: parsedOutput.job_title,
    job_summary: parsedOutput.job_summary,
    responsibilities: parsedOutput.responsibilities,
    requirements: parsedOutput.requirements,
    company_context: parsedOutput.company_context,
    product_context: parsedOutput.product_context,
    tone: parsedOutput.tone,
    useful_signals: parsedOutput.useful_signals,
    recruiter_name: parsedOutput.recruiter_name,
    raw_excerpt: extraction.text.slice(0, 1200),
    source_language: detectDominantLanguage(extraction.text),
    output_language: targetLanguage,
  };

  return NextResponse.json(research);
}
