"use server";

import { redirect } from "next/navigation";
import {
  computeCompleteness,
  formStateToInput,
  hasErrors,
  validateProfile,
  type ProfileFieldErrors,
  type ProfileFormState,
} from "@/lib/profile-form";
import { ensurePublicUser } from "@/lib/supabase/ensure-public-user";
import { createClient } from "@/lib/supabase/server";

export type SaveProfileResult =
  | { ok: true; completeness: number }
  | { ok: false; error: string; fieldErrors?: ProfileFieldErrors };

export async function saveProfileAction(
  state: ProfileFormState,
): Promise<SaveProfileResult> {
  const supabase = await createClient();

  // ---- 1. Authenticated user ----
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("[saveProfile] auth.getUser failed", {
      code: authError?.code,
      message: authError?.message,
    });
    return { ok: false, error: "Not authenticated. Please sign in again." };
  }

  // ---- 2. Field-level validation ----
  const fieldErrors = validateProfile(state);
  if (hasErrors(fieldErrors)) {
    return {
      ok: false,
      error: "Some required fields are missing or invalid.",
      fieldErrors,
    };
  }

  // ---- 3. Make sure public.users has a row for this auth user ----
  // user_profiles.user_id FK-references public.users(id). Without this row,
  // the upsert below fails with code 23503 (foreign_key_violation).
  const ensured = await ensurePublicUser(supabase, user);
  if (!ensured.ok) {
    console.error("[saveProfile] ensurePublicUser failed", {
      userId: user.id,
      error: ensured.error,
    });
    return {
      ok: false,
      error: `Couldn't prepare your account: ${ensured.error}`,
    };
  }

  // ---- 4. Build the user_profiles payload ----
  const input = formStateToInput(state);
  const trim = (v: string) => (v.length === 0 ? null : v);

  const payload = {
    user_id: user.id,
    full_name: trim(input.full_name),
    current_role: trim(input.current_role),
    location: trim(input.location),
    email: trim(input.email),
    linkedin_url: trim(input.linkedin_url),
    portfolio_url: trim(input.portfolio_url),
    preferred_language: input.preferred_language,
    years_of_experience: trim(input.years_of_experience),
    professional_summary: trim(input.professional_summary),
    skills: trim(input.skills),
    tools: trim(input.tools),
    languages: trim(input.languages),
    target_role: trim(input.target_role),
    target_industries: trim(input.target_industries),
    preferred_work_format: trim(input.preferred_work_format),
    salary_currency: input.salary_currency,
    salary_min: input.salary_min,
    salary_max: input.salary_max,
    salary_period: input.salary_period,
    raw_cv_text: trim(input.raw_cv_text),
  };

  // ---- 5. Upsert ----
  const { error: upsertError } = await supabase
    .from("user_profiles")
    .upsert(payload, { onConflict: "user_id" });

  if (upsertError) {
    console.error("[saveProfile] user_profiles upsert failed", {
      userId: user.id,
      code: upsertError.code,
      message: upsertError.message,
      details: upsertError.details,
      hint: upsertError.hint,
    });
    return { ok: false, error: upsertError.message };
  }

  return { ok: true, completeness: computeCompleteness(state) };
}

// Lets the user enter the app before finishing onboarding. Creates a
// near-empty user_profiles row so the (app) layout gate (which now
// only requires the row to exist) lets them through. Completeness
// will be 0, the soft completeness banner shows on every page, and AI
// surfaces (cover letters) still refuse to run server-side until the
// profile is filled in. Expands surface area without changing the
// security boundary.
//
// Wired as a form action — calls redirect() on success so the browser
// goes straight to /dashboard. Failures bounce back to /onboarding.
export async function skipOnboardingAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/login");
  }

  const ensured = await ensurePublicUser(supabase, user);
  if (!ensured.ok) {
    console.error("[skipOnboarding] ensurePublicUser failed", {
      userId: user.id,
      error: ensured.error,
    });
    redirect("/onboarding");
  }

  const { error: upsertError } = await supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        email: user.email ?? null,
        preferred_language: "en",
      },
      { onConflict: "user_id" },
    );
  if (upsertError) {
    console.error("[skipOnboarding] upsert failed", {
      userId: user.id,
      code: upsertError.code,
      message: upsertError.message,
    });
    redirect("/onboarding");
  }
  redirect("/dashboard");
}
