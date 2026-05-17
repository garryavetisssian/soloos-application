// Given a validated link's page text + classification, produce the two
// AI-generated fields stored alongside it: a short "what's inside"
// summary and a "where to use it" hint for the cover-letter prompt.
//
// Both fields are user-editable after generation. If Gemini fails we
// fall back to empty strings — the link is still saved (status:
// "ready") since validation already passed; the user just sees blank
// summary fields they can fill in manually.

import {
  GEMINI_FALLBACK_MODEL,
  GEMINI_MODEL,
  getGemini,
  shouldRetryOnFallbackModel,
} from "@/lib/gemini/client";
import { PROMPTS } from "@/lib/gemini/prompts";
import {
  downloadFigmaThumbnailAsBase64,
  renderFigmaFramesAsBase64,
  type RenderedImage,
} from "./figma-render";
import type { VisualQuality, WorkLinkType } from "./types";

export interface EnrichmentResult {
  summary: string;
  coverLetterHint: string;
  /** Vision-grounded grading of the image(s) we sent Gemini. Present
   *  only on the Figma Vision path when Gemini returned the structured
   *  block; absent on text-only enrichment and when Gemini failed. The
   *  action layer merges this into the persisted QualitySignals so the
   *  quality bar can differentiate files even when /v1/files is
   *  rate-locked. */
  visualQuality?: VisualQuality;
}

/**
 * Extra context the Figma path provides.
 *  - `fileKey` + `frameIds`: try to render those frames via /v1/images.
 *  - `thumbnailUrl`: pre-signed S3 URL of the file's preview PNG,
 *    returned by /v1/files. Free to fetch (no Figma API quota), so
 *    we always include it as a Vision input when present — that
 *    means even if frame rendering is rate-limited we still produce
 *    a summary from the thumbnail.
 */
export interface EnrichmentExtras {
  fileKey?: string;
  frameIds?: string[];
  thumbnailUrl?: string | null;
}

// Short summary task — flash-lite is plenty here. We use it as the
// PRIMARY for portfolio enrichment specifically because (a) the
// quality is indistinguishable for a 1–2 sentence summary, and
// (b) flash-lite's free-tier daily quota is dramatically higher than
// flash's, so users adding many portfolio links don't run into the
// daily cap. flash is the fallback in case lite is itself busy.
async function generateJsonWithFallback(prompt: string): Promise<string> {
  const tryOnce = async (modelName: string) => {
    const model = getGemini().getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  };
  try {
    return await tryOnce(GEMINI_FALLBACK_MODEL);
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (!shouldRetryOnFallbackModel(e)) throw err;
    return await tryOnce(GEMINI_MODEL);
  }
}

export async function enrichWorkLink(
  url: string,
  type: WorkLinkType,
  pageText: string,
  extras: EnrichmentExtras = {},
): Promise<EnrichmentResult> {
  const result = await runEnrichment(url, type, pageText, extras);
  // Hint rescue: Gemini sometimes returns a real summary but skips
  // the cover_letter_hint. Run a tiny follow-up that derives the hint
  // from the summary so every described link gets a hint, not just
  // the ones Gemini felt confident enough about on the first pass.
  return ensureCoverLetterHint(url, type, result);
}

async function runEnrichment(
  url: string,
  type: WorkLinkType,
  pageText: string,
  extras: EnrichmentExtras,
): Promise<EnrichmentResult> {
  // For Figma, prefer the Vision path — it sees the actual canvas
  // and works even when frame names are garbage ("Frame 87", "01").
  // The text-only path serves as fallback if both image sources
  // (frame renders + thumbnail) come back empty.
  if (
    type === "figma" &&
    (extras.thumbnailUrl ||
      (extras.fileKey && (extras.frameIds?.length ?? 0) > 0))
  ) {
    const visual = await enrichWorkLinkVisual(
      url,
      pageText,
      extras.fileKey,
      extras.frameIds ?? [],
      extras.thumbnailUrl,
    );
    if (visual.summary) return visual;
    // else fall through to text-only attempt
  }

  // Text-only path. Used for everything that isn't Figma, plus as
  // the fallback when vision didn't yield anything.
  if (!pageText.trim()) {
    return { summary: "", coverLetterHint: "" };
  }
  try {
    const raw = await generateJsonWithFallback(
      PROMPTS.workLinkSummary(url, type, pageText),
    );
    return parseSummaryJson(raw);
  } catch (err) {
    console.error("[work-links/enrich] text Gemini error", err);
    return { summary: "", coverLetterHint: "" };
  }
}

// Guarantee a cover-letter hint whenever we produced a real summary.
// Gemini will occasionally write a confident summary and then return
// an empty hint, especially on files where the visual evidence is
// mixed (Duck Master's "cover slide for a Telegram Mini App but no
// detailed screens" case). Without this rescue the card silently
// loses the most useful field for cover-letter writing. The
// follow-up call is small, focused, and tolerated to fail silently —
// we never make a missing hint worse than it already is.
async function ensureCoverLetterHint(
  url: string,
  type: WorkLinkType,
  result: EnrichmentResult,
): Promise<EnrichmentResult> {
  if (!result.summary.trim()) return result;
  if (result.coverLetterHint.trim()) return result;
  // 1. Preferred: tiny Gemini follow-up that derives a hint from the
  //    summary. Specific, well-phrased — when it works.
  try {
    const tryOnce = async (modelName: string) => {
      const model = getGemini().getGenerativeModel({ model: modelName });
      const r = await model.generateContent(
        PROMPTS.coverLetterHintFromSummary(url, type, result.summary),
      );
      return r.response.text();
    };
    let raw: string;
    try {
      raw = await tryOnce(GEMINI_FALLBACK_MODEL);
    } catch (err) {
      const e = err as { status?: number; message?: string };
      if (!shouldRetryOnFallbackModel(e)) throw err;
      raw = await tryOnce(GEMINI_MODEL);
    }
    const hint = cleanHint(raw);
    if (hint) return { ...result, coverLetterHint: hint };
  } catch (err) {
    console.warn("[work-links/enrich] hint rescue failed", err);
  }
  // 2. Deterministic last-resort. Runs when both Gemini paths failed
  //    (quota exhausted, network, model refusal). Pattern-matches the
  //    summary for common product / domain anchors so the fallback
  //    feels grounded, and falls back to a type-based template when
  //    nothing matches. The point is: whenever there's a summary, the
  //    user sees A hint — never a missing field.
  const fallback = deriveFallbackHint(result.summary, type);
  if (fallback) return { ...result, coverLetterHint: fallback };
  return result;
}

// Always-on hint generator from a non-empty summary. Order of
// preference: (1) a specific anchor matched in the summary text,
// (2) a type-based template. Output capped at 140 chars to match
// what Gemini would return.
function deriveFallbackHint(summary: string, type: WorkLinkType): string {
  if (!summary.trim()) return "";
  const lower = summary.toLowerCase();
  // Anchor patterns matched in summary order — first hit wins. Keep
  // labels short and natural in a hint sentence.
  const anchors: Array<[RegExp, string]> = [
    [/telegram\s+(mini[-\s]?)?(app|bot)/i, "Telegram bot or Mini App"],
    [/mini\s*app/i, "Mini App"],
    [/mobile\s+game/i, "mobile-game"],
    [/mobile\s+app/i, "mobile-app"],
    [/web\s+(app|application)/i, "web-app"],
    [/landing\s+page/i, "landing-page or marketing-site"],
    [/dashboard|admin\s+panel/i, "dashboard or internal-tool"],
    [/booking|scheduling|appointment/i, "booking or scheduling product"],
    [/e[-\s]?commerce|shop|checkout/i, "e-commerce"],
    [/design\s+system|ui\s+kit|component\s+library/i, "design-system or UI-kit"],
    [/onboarding/i, "onboarding flow"],
    [/saas|b2b/i, "SaaS or B2B product"],
    [/marketing|brand/i, "brand or marketing"],
    [/illustration|graphic/i, "illustration or graphic-design"],
    [/print|catalogue|magazine|book/i, "print or editorial design"],
    [/dating|social/i, "consumer social product"],
    [/finance|fintech|payment/i, "fintech or payments"],
    [/health|medical|wellness/i, "health or wellness product"],
    [/education|edtech|learning/i, "education or e-learning product"],
  ];
  for (const [regex, label] of anchors) {
    if (regex.test(lower)) {
      return `Reference when applying to ${label} roles.`.slice(0, 140);
    }
  }
  // No specific anchor — use a type-based template. Still grounded in
  // what kind of artefact this is.
  const typeBlurb: Record<WorkLinkType, string> = {
    portfolio: "product / design",
    github: "engineering or code-focused",
    figma: "UI or product-design",
    dribbble: "visual / UI design",
    behance: "design portfolio",
    app_store: "shipped consumer-product",
    article: "writing or thought-leadership",
    video: "motion or video-production",
    other: "similar kind of",
  };
  return `Reference when discussing ${typeBlurb[type]} work.`.slice(0, 140);
}

// Strip surrounding quotes, markdown fences, and trailing newlines
// from the rescue model's reply. The prompt asks for a bare sentence,
// but models occasionally wrap output in quotes or json-fence it.
function cleanHint(raw: string): string {
  let s = raw.trim();
  // Drop json fences if the model wrapped its reply.
  s = s.replace(/^```(?:json|text)?\s*/i, "").replace(/```$/i, "").trim();
  // Drop surrounding quotes.
  s = s.replace(/^["'`]+|["'`]+$/g, "").trim();
  // If the model returned multi-line, keep the first non-empty line.
  const firstLine = s.split(/\n+/).map((l) => l.trim()).find(Boolean);
  return (firstLine ?? "").slice(0, 400);
}

async function enrichWorkLinkVisual(
  url: string,
  fileMetadata: string,
  fileKey: string | undefined,
  frameIds: string[],
  thumbnailUrl?: string | null,
): Promise<EnrichmentResult> {
  // Single-call strategy: Figma's /v1/files response already includes
  // a thumbnailUrl — a pre-rendered, presentation-ready PNG of the
  // file, served from S3 via a pre-signed URL. Downloading it doesn't
  // touch any Figma API quota at all. We feed it to Gemini Vision
  // along with the document-tree metadata (page names, frame names),
  // which is enough context for a real summary.
  //
  // We deliberately do NOT call /v1/images here even when frameIds
  // are available. Figma's free Starter plan charges /v1/images calls
  // against a per-file quota that locks the file for days once
  // exceeded. The thumbnail is enough for the typical case; users
  // who want richer multi-screen analysis would trigger that via a
  // future "deep refresh" button.
  // Gather Vision inputs from two complementary sources:
  //   • Cover thumbnail (free, no Figma quota) — Figma's pre-rendered
  //     800×480 preview that downloads from their CDN.
  //   • Actual frame render via /v1/images — costs 1 API quota call,
  //     gives Gemini a real screen from inside the file (essential
  //     for purely-visual files with no text layers and no
  //     meaningful frame names, where the thumbnail alone might be
  //     sparse or generic).
  // Both passed to a single Gemini Vision call. Together they cover
  // every reasonable file shape: text-rich (Vision sees text in the
  // frame), visually-rich (Vision sees illustrations/layout in both
  // images), or mixed.
  const images: RenderedImage[] = [];
  if (thumbnailUrl) {
    const thumb = await downloadFigmaThumbnailAsBase64(thumbnailUrl);
    if (thumb) {
      // Even tiny thumbnails carry signal (palette, brand mark) — we
      // keep them because adding the rendered frame below gives
      // Gemini the missing content detail.
      images.push(thumb);
    }
  }
  if (fileKey && frameIds.length > 0) {
    // renderFigmaFramesAsBase64 already serializes calls + retries on
    // 429 + skips failed individual frames. We pass the top 1–2 IDs
    // the validator picked (size-filtered, ranked by "screen-shape").
    const frames = await renderFigmaFramesAsBase64(fileKey, frameIds);
    for (const f of frames) images.push(f);
  }
  if (images.length === 0) return { summary: "", coverLetterHint: "" };
  // Reference frameIds so it remains a valid parameter even when
  // unused on the happy path (we may use it again on the deep-refresh
  // path in a follow-up).
  void frameIds;

  // Same model preference as the text path: flash-lite first (much
  // bigger free quota), flash as fallback.
  const visionOnce = async (modelName: string) => {
    const model = getGemini().getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent([
      { text: PROMPTS.workLinkVisualSummary(url, fileMetadata) },
      ...images.map((img) => ({
        inlineData: { mimeType: img.mimeType, data: img.base64 },
      })),
    ]);
    return parseSummaryJson(result.response.text());
  };

  try {
    return await visionOnce(GEMINI_FALLBACK_MODEL);
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (shouldRetryOnFallbackModel(e)) {
      try {
        return await visionOnce(GEMINI_MODEL);
      } catch (err2) {
        console.error("[work-links/enrich] vision fallback error", err2);
      }
    } else {
      console.error("[work-links/enrich] vision Gemini error", err);
    }
    return { summary: "", coverLetterHint: "" };
  }
}

function parseSummaryJson(raw: string): EnrichmentResult {
  try {
    const parsed = JSON.parse(raw) as {
      summary?: unknown;
      cover_letter_hint?: unknown;
      visual_quality?: unknown;
    };
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      coverLetterHint:
        typeof parsed.cover_letter_hint === "string"
          ? parsed.cover_letter_hint
          : "",
      visualQuality: parseVisualQuality(parsed.visual_quality),
    };
  } catch {
    return { summary: "", coverLetterHint: "" };
  }
}

// Coerce the model's visual_quality object into a strict booleans-only
// shape. Missing fields default to false (conservative — Vision didn't
// confirm them). Returns undefined when the field is absent entirely,
// which signals "no Vision grading available" to the scoring layer
// (text-only path, model parse failure, etc.).
function parseVisualQuality(raw: unknown): VisualQuality | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const v = raw as Record<string, unknown>;
  return {
    hasSpecificContent: v.has_specific_content === true,
    hasRealUiText: v.has_real_ui_text === true,
    looksFinished: v.looks_finished === true,
    looksBlankOrPlaceholder: v.looks_blank_or_placeholder === true,
  };
}
