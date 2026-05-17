import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { I18nProvider } from "@/lib/i18n/provider";
import { ActionLockProvider } from "@/lib/ui/action-lock";
import { ToastProvider } from "@/lib/ui/toast";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/types";
import {
  COVER_LETTER_MIN_COMPLETENESS,
  computeCompleteness,
  formStateFromRow,
} from "@/lib/profile-form";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Soft onboarding gate — only the profile row needs to exist. The
  // strict completeness gate is gone; users can now skip into the app
  // and complete their profile from /settings/profile at their own
  // pace. AI surfaces (cover-letter generation) still enforce
  // completeness server-side, so the security boundary is preserved.
  // Below the threshold a dismissible banner nudges them toward
  // /settings/profile.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  const userProfile = profile as UserProfile;
  const completeness = computeCompleteness(formStateFromRow(userProfile));

  const initialLocale: Locale =
    userProfile.preferred_language &&
    (SUPPORTED_LOCALES as readonly string[]).includes(
      userProfile.preferred_language,
    )
      ? (userProfile.preferred_language as Locale)
      : DEFAULT_LOCALE;

  return (
    <I18nProvider initialLocale={initialLocale}>
      <ToastProvider>
        <ActionLockProvider>
          <AppShell
            email={user.email ?? ""}
            displayName={userProfile.full_name}
            completeness={completeness}
            completenessThreshold={COVER_LETTER_MIN_COMPLETENESS}
          >
            {children}
          </AppShell>
        </ActionLockProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
