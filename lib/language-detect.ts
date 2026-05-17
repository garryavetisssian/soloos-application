// Detect the language of a piece of text from the SoloOS-supported set.
// The detector is intentionally simple: it inspects character ranges, not
// linguistic structure. Used both client-side (for the "Detected language"
// helper row on the cover letters page) and server-side (to instruct
// Gemini which language to write the cover letter in).
//
// Priority order matches the product rule:
//   Armenian Unicode block → "Armenian"
//   Cyrillic block         → "Russian"
//   otherwise              → "English"
//
// Picks Armenian first so a job posting with mixed Cyrillic + Armenian
// (rare but possible) still produces an Armenian cover letter, since the
// Armenian-script signal is the more specific indicator.

export type DetectedLanguage = "English" | "Russian" | "Armenian";

const ARMENIAN_RE = /[԰-֏ﬓ-ﬗ]/;
const CYRILLIC_RE = /[Ѐ-ӿԀ-ԯ]/;

export function detectJobLanguage(text: string): DetectedLanguage {
  if (ARMENIAN_RE.test(text)) return "Armenian";
  if (CYRILLIC_RE.test(text)) return "Russian";
  return "English";
}
