import { dictionaries } from "./dictionaries";
import { DEFAULT_LOCALE, type Locale } from "./types";

// Walk a dotted path inside the dictionary tree.
function lookup(dict: object, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = dict;
  for (const part of parts) {
    if (cur && typeof cur === "object" && part in cur) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(
  template: string,
  vars: Record<string, string | number> | undefined,
): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

// Translate a dotted-path key. Falls back to the default locale, then to
// the key itself so missing translations are visible during development.
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dict = dictionaries[locale];
  const fromLocale = lookup(dict, key);
  if (fromLocale != null) return interpolate(fromLocale, vars);
  if (locale !== DEFAULT_LOCALE) {
    const fallback = lookup(dictionaries[DEFAULT_LOCALE], key);
    if (fallback != null) return interpolate(fallback, vars);
  }
  return key;
}

// Curry-friendly form for components that pass `t` around.
export function makeT(locale: Locale) {
  return (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
}
