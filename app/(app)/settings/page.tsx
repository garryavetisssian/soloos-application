import { redirect } from "next/navigation";

// /settings is no longer a top-level destination — Profile + Settings
// were merged into a single "Profile" entry in the top-bar account
// dropdown that points to /settings/profile. Anyone hitting /settings
// directly (old bookmark, command palette entry, etc.) lands on the
// merged profile page.
export default function SettingsPage() {
  redirect("/settings/profile");
}
