import { redirect } from "next/navigation";
import {
  COVER_LETTER_MIN_COMPLETENESS,
  computeCompleteness,
  formStateFromRow,
} from "@/lib/profile-form";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/lib/types";
import { OnboardingFlow } from "./onboarding-flow";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existing } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const profile = existing as UserProfile;
    const initial = formStateFromRow(profile);
    const completeness = computeCompleteness(initial);
    // Already onboarded → straight into the product.
    if (completeness >= COVER_LETTER_MIN_COMPLETENESS) redirect("/dashboard");
    // Partial profile — resume onboarding with what they had.
    return (
      <OnboardingFlow defaultEmail={user.email ?? ""} initial={initial} />
    );
  }

  return <OnboardingFlow defaultEmail={user.email ?? ""} />;
}
