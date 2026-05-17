// CV text extraction pipeline.
//
//   pdf-parse  →  if enough selectable text, return it (text mode).
//   otherwise  →  return the original PDF buffer for the route to feed
//                 directly to Gemini's multimodal API (vision_pdf mode).
//
// No native dependencies — no PNG rendering, no canvas, no OCR. Gemini
// accepts PDFs via inlineData and handles vision internally.

import pdfParse from "pdf-parse/lib/pdf-parse.js";

const TEXT_PIPELINE_MIN_CHARS = 200;

export type ExtractMode = "text" | "vision_pdf";

export type ExtractFailureReason = "encrypted";

export type ExtractResult =
  | { ok: true; mode: "text"; text: string }
  | { ok: true; mode: "vision_pdf"; data: Buffer }
  | { ok: false; reason: ExtractFailureReason; detail?: string };

export function cleanCvText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// =============================================================
// Public entrypoint
// =============================================================

export async function extractCv(
  buffer: Buffer,
  onPhaseChange?: (phase: ExtractMode) => void,
): Promise<ExtractResult> {
  // ---- 1. Try pdf-parse text extraction ----
  let text = "";
  try {
    onPhaseChange?.("text");
    const parsed = await pdfParse(buffer);
    text = cleanCvText(parsed.text ?? "");
  } catch (err) {
    const e = err as { message?: string; name?: string };
    const isEncrypted =
      /encrypt|password/i.test(e.message ?? "") ||
      /password/i.test(e.name ?? "");
    if (isEncrypted) {
      return { ok: false, reason: "encrypted", detail: e.message };
    }
    // Other parse errors fall through — Gemini might still read it as a PDF.
    text = "";
  }

  if (text.length >= TEXT_PIPELINE_MIN_CHARS) {
    return { ok: true, mode: "text", text };
  }

  // ---- 2. Vision fallback — hand the original PDF to Gemini ----
  onPhaseChange?.("vision_pdf");
  return { ok: true, mode: "vision_pdf", data: buffer };
}
