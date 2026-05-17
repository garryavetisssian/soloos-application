// Supported app interface locales. Mirrors user_profiles.preferred_language.
// To add a new locale: extend this union, add a directory under /locales/<code>,
// add it to dictionaries.ts, and update the language switcher / DB CHECK.

export type Locale = "en" | "ru" | "hy";

export const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ["en", "ru", "hy"];

export const DEFAULT_LOCALE: Locale = "en";

// User-visible language name in the AI's own output instructions. Used by
// the cover-letter prompt as `targetLanguage`. Distinct from the interface
// locale: a Russian-speaking user can still ask for an English letter.
export type OutputLanguage = "English" | "Russian" | "Armenian";

export const OUTPUT_LANGUAGES: ReadonlyArray<OutputLanguage> = [
  "English",
  "Russian",
  "Armenian",
];

export function localeToOutputLanguage(locale: Locale): OutputLanguage {
  switch (locale) {
    case "en":
      return "English";
    case "ru":
      return "Russian";
    case "hy":
      return "Armenian";
  }
}

export function outputLanguageToLocale(lang: OutputLanguage): Locale {
  switch (lang) {
    case "English":
      return "en";
    case "Russian":
      return "ru";
    case "Armenian":
      return "hy";
  }
}
