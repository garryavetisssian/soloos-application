// Shared language-normalization helpers.
//
// Goal: keep every user-facing AI result in a single, consistent language —
// the one the user explicitly chose. The job-page extractor and cover-letter
// generator both use these helpers so a Russian-language job page rendered in
// English UI never produces mixed-language sections.
//
// Strategy:
// 1. Single-pass extraction. The /api/ai/job-research prompt asks Gemini to
//    produce its output directly in `targetLanguage`, so we usually never
//    need a second pass.
// 2. On-demand re-normalization. When the user switches the output language
//    after analyzing a link, the UI calls /api/ai/normalize-research, which
//    delegates here. We translate the already-extracted fields rather than
//    re-fetching the source page.
//
// Proper nouns (company names, product names, tools, URLs, person names)
// are passed through verbatim — the prompt enforces this. We do not attempt
// to translate them on the server.

import {
  GEMINI_FALLBACK_MODEL,
  GEMINI_MODEL,
  getGemini,
  shouldRetryOnFallbackModel,
} from "@/lib/gemini/client";
import { PROMPTS } from "@/lib/gemini/prompts";
import type { OutputLanguage } from "@/lib/i18n/types";
import { detectJobLanguage } from "@/lib/language-detect";
import type { JobResearch } from "@/lib/job-research/types";

// User-facing string fields on JobResearch that participate in normalization.
const NORMALIZABLE_FIELDS = [
  "company_name",
  "job_title",
  "job_summary",
  "responsibilities",
  "requirements",
  "company_context",
  "product_context",
  "tone",
] as const;

type NormalizableSubset = Pick<
  JobResearch,
  (typeof NORMALIZABLE_FIELDS)[number] | "useful_signals" | "recruiter_name"
>;

function pickNormalizableSubset(r: JobResearch): NormalizableSubset {
  return {
    company_name: r.company_name,
    job_title: r.job_title,
    job_summary: r.job_summary,
    responsibilities: r.responsibilities,
    requirements: r.requirements,
    company_context: r.company_context,
    product_context: r.product_context,
    tone: r.tone,
    useful_signals: r.useful_signals,
    recruiter_name: r.recruiter_name ?? "",
  };
}

// Detect the dominant language of a piece of text. Wraps detectJobLanguage
// so callers don't need to import two modules.
export function detectDominantLanguage(text: string): OutputLanguage {
  return detectJobLanguage(text);
}

// Re-normalize an existing JobResearch object into a new target language.
// Returns the new normalized JobResearch. If `targetLanguage` already matches
// `research.output_language`, returns the input unchanged (no AI call).
//
// Throws on Gemini failure — the caller maps it to the right HTTP response.
export async function normalizeJobResearch(
  research: JobResearch,
  targetLanguage: OutputLanguage,
): Promise<JobResearch> {
  if (research.output_language === targetLanguage) return research;

  const subset = pickNormalizableSubset(research);
  const prompt = PROMPTS.normalizeResearch(subset, targetLanguage);

  const tryOnce = async (modelName: string) => {
    const model = getGemini().getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  };

  let raw: string;
  try {
    raw = await tryOnce(GEMINI_MODEL);
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (!shouldRetryOnFallbackModel(e)) throw err;
    raw = await tryOnce(GEMINI_FALLBACK_MODEL);
  }

  const parsed = JSON.parse(raw) as Partial<NormalizableSubset>;
  return {
    ...research,
    company_name: stringOr(parsed.company_name, research.company_name),
    job_title: stringOr(parsed.job_title, research.job_title),
    job_summary: stringOr(parsed.job_summary, research.job_summary),
    responsibilities: stringOr(
      parsed.responsibilities,
      research.responsibilities,
    ),
    requirements: stringOr(parsed.requirements, research.requirements),
    company_context: stringOr(
      parsed.company_context,
      research.company_context,
    ),
    product_context: stringOr(
      parsed.product_context,
      research.product_context,
    ),
    tone: stringOr(parsed.tone, research.tone),
    useful_signals: Array.isArray(parsed.useful_signals)
      ? parsed.useful_signals.map((s) => String(s)).filter(Boolean)
      : research.useful_signals,
    // recruiter_name is a person name → verbatim across translations.
    // Trust the prompt to preserve it, but defensively fall back to the
    // pre-normalization value if the model dropped it.
    recruiter_name: stringOr(parsed.recruiter_name, research.recruiter_name),
    output_language: targetLanguage,
  };
}

function stringOr(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}
