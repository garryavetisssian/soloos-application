// Read a hh.ru vacancy via its server-rendered social-share image.
//
// Why this exists: hh.ru aggressively blocks both static HTML scraping
// (returns a "please enable JavaScript" stub) and unauthenticated API
// access (403 forbidden). But every vacancy has a server-rendered
// preview PNG at https://thumbnail.hh.ru/vacancy/{id}.png that
// contains the full job content rendered for social sharing. We
// download that image and let Gemini Vision read it.
//
// Output: plain text in the same shape extractJobPage returns, so the
// rest of the job-research pipeline doesn't change.

import {
  GEMINI_FALLBACK_MODEL,
  GEMINI_MODEL,
  getGemini,
  shouldRetryOnFallbackModel,
} from "@/lib/gemini/client";

const THUMB_TIMEOUT_MS = 15_000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/**
 * Parse the numeric vacancy ID out of an hh.ru URL.
 * Accepts hh.ru, hh.kz, and other regional hh.* domains.
 *  - https://hh.ru/vacancy/133014384
 *  - https://hh.ru/vacancy/133014384?hhtmFrom=vacancy
 *  - https://moscow.hh.ru/vacancy/133014384
 */
export function parseHhVacancyId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (!/(^|\.)hh\.(ru|kz|by|am|kg|uz)$/.test(u.hostname)) return null;
    const m = u.pathname.match(/\/vacancy\/(\d+)\b/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function isHhUrl(rawUrl: string): boolean {
  return parseHhVacancyId(rawUrl) !== null;
}

export interface HhExtraction {
  ok: true;
  url: string;
  title: string;
  metaDescription: string;
  text: string;
}

export interface HhExtractionError {
  ok: false;
  reason: "invalid_url" | "thumb_unavailable" | "vision_failed";
}

export type HhResult = HhExtraction | HhExtractionError;

/**
 * Fetch the hh.ru server-rendered vacancy thumbnail and ask Gemini
 * Vision to transcribe + structure it as a job description.
 */
export async function fetchHhVacancy(rawUrl: string): Promise<HhResult> {
  const id = parseHhVacancyId(rawUrl);
  if (!id) return { ok: false, reason: "invalid_url" };

  // 1. Download the social-share PNG.
  let buf: Buffer;
  try {
    const res = await fetch(
      `https://thumbnail.hh.ru/vacancy/${id}.png?host=hh.ru`,
      {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko)",
          accept: "image/png,image/*",
        },
        signal: AbortSignal.timeout(THUMB_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      return { ok: false, reason: "thumb_unavailable" };
    }
    buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_IMAGE_BYTES) {
      return { ok: false, reason: "thumb_unavailable" };
    }
  } catch {
    return { ok: false, reason: "thumb_unavailable" };
  }

  const base64 = buf.toString("base64");

  // 2. Vision pass. We ask Gemini to read everything visible on the
  //    thumbnail and reproduce it as a structured plaintext job
  //    description we can pipe into the regular job-research path.
  const prompt = `The attached PNG is a server-rendered preview of a job vacancy from hh.ru. Read every visible piece of text — title, company name, salary, location, employment type, requirements, description text — and reproduce it as a plain-text job description suitable for AI summarisation.

Output ONLY a JSON object — no preamble, no markdown — with these keys:
- "title": the job title visible on the image (string, may be empty).
- "company": company name visible on the image (string, may be empty).
- "description": ONE plain-text block containing the rest of the vacancy content as it appears on the image. Preserve order. Keep the original language verbatim (Russian / English). Do NOT translate. Do NOT add explanatory commentary. Drop only obvious chrome ("hh.ru", "ОТКЛИКНУТЬСЯ" buttons, page numbers).`;

  const tryVision = async (modelName: string): Promise<string> => {
    const model = getGemini().getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: "image/png", data: base64 } },
    ]);
    return result.response.text();
  };

  let raw: string;
  try {
    raw = await tryVision(GEMINI_MODEL);
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (!shouldRetryOnFallbackModel(e)) {
      console.error("[hh-ru] vision error", err);
      return { ok: false, reason: "vision_failed" };
    }
    try {
      raw = await tryVision(GEMINI_FALLBACK_MODEL);
    } catch (err2) {
      console.error("[hh-ru] vision fallback error", err2);
      return { ok: false, reason: "vision_failed" };
    }
  }

  // Parse + assemble into the extract-success shape the rest of the
  // pipeline expects.
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
      typeof parsed.description === "string"
        ? parsed.description.trim()
        : "";
    if (!title && !description) {
      return { ok: false, reason: "vision_failed" };
    }
    // Compose the text block downstream prompts will read. Keep the
    // hh.ru source URL visible so the cover-letter prompt has it for
    // employer-context detection.
    const composedTextParts: string[] = [];
    if (title || company) {
      composedTextParts.push(
        `${title || "Role"}${company ? ` — ${company}` : ""}`,
      );
    }
    if (description) composedTextParts.push(description);
    const composedText = composedTextParts.join("\n\n");
    return {
      ok: true,
      url: rawUrl,
      title: title || company || "hh.ru vacancy",
      metaDescription: company,
      text: composedText,
    };
  } catch (err) {
    console.error("[hh-ru] JSON parse error", err);
    return { ok: false, reason: "vision_failed" };
  }
}
