// Server-side i18n helpers. Reads the user's preferred locale from
// public.users / public.user_profiles. Used by server components that need
// to render translated text directly (instead of going through the client
// I18nProvider).

import { getCurrentProfile } from "@/lib/profile";
import { makeT } from "./translate";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "./types";

export async function getCurrentLocale(): Promise<Locale> {
  const profile = await getCurrentProfile();
  const candidate = profile?.preferred_language;
  if (candidate && (SUPPORTED_LOCALES as readonly string[]).includes(candidate)) {
    return candidate as Locale;
  }
  return DEFAULT_LOCALE;
}

export async function getServerT() {
  const locale = await getCurrentLocale();
  return { locale, t: makeT(locale) };
}
