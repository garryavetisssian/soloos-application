"use server";

import { ensurePublicUser } from "@/lib/supabase/ensure-public-user";
import { createClient } from "@/lib/supabase/server";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/types";

// Persist the user's chosen interface locale to user_profiles.preferred_language.
// Called from the client I18nProvider whenever the user picks a new language
// in the global switcher. Failures are non-fatal — the client keeps the
// localStorage copy so the session still works.
export async function setLocaleAction(
  locale: Locale,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return { ok: false, error: "unsupported_locale" };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, error: "unauthenticated" };
  }

  // Make sure the public.users mirror exists so we can update its
  // user_profiles row. The trigger handles this for new signups, but
  // existing users may still need the safety net.
  await ensurePublicUser(supabase, user);

  const { error } = await supabase
    .from("user_profiles")
    .update({ preferred_language: locale })
    .eq("user_id", user.id);

  if (error) {
    console.error("[setLocale] update failed", {
      userId: user.id,
      locale,
      code: error.code,
      message: error.message,
    });
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
