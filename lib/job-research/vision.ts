// Shared Gemini Vision transcription for job preview images.
//
// Some platforms render the whole posting client-side and block static
// reads, but expose a server-rendered preview/social-share image that
// contains the posting text. When HTML + JSON-LD both fail, we download
// that image and let Gemini Vision read it back into plain text. Used by
// the hh.ru adapter (its dedicated thumbnail) and as a generic last-resort
// fallback on any page's og:image.

import {
  GEMINI_FALLBACK_MODEL,
  GEMINI_MODEL,
  getGemini,
  shouldRetryOnFallbackModel,
} from "@/lib/gemini/client";

export interface VisionTranscript {
  title: string;
  company: string;
  description: string;
}

const PROMPT = `The attached image is a preview of a job vacancy posting. Read every visible piece of text — title, company name, salary, location, employment type, requirements, responsibilities, description — and reproduce it as a plain-text job description suitable for AI summarisation.

Output ONLY a JSON object — no preamble, no markdown — with these keys:
- "title": the job title visible in the image (string, may be empty).
- "company": company name visible in the image (string, may be empty).
- "description": ONE plain-text block with the rest of the vacancy content as it appears. Preserve order. Keep the original language verbatim. Do NOT translate. Do NOT add commentary. Drop only obvious chrome (site logos, "Apply"/"Откликнуться" buttons, page numbers).`;

/**
 * Ask Gemini Vision to transcribe a job preview image into structured text.
 * Returns null when the model can't read anything useful from it.
 */
export async function transcribeJobImage(
  data: Buffer,
  mimeType: string,
): Promise<VisionTranscript | null> {
  const base64 = data.toString("base64");

  const tryVision = async (modelName: string): Promise<string> => {
    const model = getGemini().getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent([
      { text: PROMPT },
      { inlineData: { mimeType, data: base64 } },
    ]);
    return result.response.text();
  };

  let raw: string;
  try {
    raw = await tryVision(GEMINI_MODEL);
  } catch (err) {
    if (!shouldRetryOnFallbackModel(err as { status?: number })) {
      console.error("[vision] transcription error", err);
      return null;
    }
    try {
      raw = await tryVision(GEMINI_FALLBACK_MODEL);
    } catch (err2) {
      console.error("[vision] transcription fallback error", err2);
      return null;
    }
  }

  try {
    const parsed = JSON.parse(raw) as {
      title?: unknown;
      company?: unknown;
      description?: unknown;
    };
    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    const company =
      typeof parsed.company === "string" ? parsed.company.trim() : "";
    const description =
      typeof parsed.description === "string" ? parsed.description.trim() : "";
    if (!title && !description) return null;
    return { title, company, description };
  } catch (err) {
    console.error("[vision] JSON parse error", err);
    return null;
  }
}

/** Compose a VisionTranscript into the plain-text block downstream reads. */
export function transcriptToText(t: VisionTranscript): string {
  const parts: string[] = [];
  if (t.title || t.company) {
    parts.push(`${t.title || "Role"}${t.company ? ` — ${t.company}` : ""}`);
  }
  if (t.description) parts.push(t.description);
  return parts.join("\n\n").trim();
}
