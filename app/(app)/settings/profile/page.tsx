import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { formStateFromRow } from "@/lib/profile-form";
import { ProfileEditForm } from "./profile-edit-form";

export default async function SettingsProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");
  return <ProfileEditForm initial={formStateFromRow(profile)} />;
}
