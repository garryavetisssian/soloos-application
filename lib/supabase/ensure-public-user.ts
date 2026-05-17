import type { SupabaseClient, User } from "@supabase/supabase-js";

export type EnsureResult = { ok: true } | { ok: false; error: string };

// Make sure a public.users row exists for the authenticated user.
//
// The handle_new_user trigger normally creates this row on signup, but we
// can't assume it ran:
//   - users created before the trigger was attached have no row
//   - the trigger can be disabled or fail silently
//   - users created out-of-band via the admin API may bypass it
//
// `user_profiles.user_id` FK-references `public.users(id)`, so saving the
// profile fails with a foreign-key violation when the row is missing. This
// helper plugs that gap by check-then-inserting.
//
// RLS note: this requires an INSERT policy on public.users that allows
// `auth.uid() = id`. See migration 20260429000003_backfill_public_users.sql.
export async function ensurePublicUser(
  supabase: SupabaseClient,
  user: User,
): Promise<EnsureResult> {
  const { data: existing, error: selectError } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (selectError) {
    console.error("[ensurePublicUser] select failed", {
      userId: user.id,
      code: selectError.code,
      message: selectError.message,
    });
    return { ok: false, error: selectError.message };
  }
  if (existing) return { ok: true };

  const { error: insertError } = await supabase.from("users").insert({
    id: user.id,
    email: user.email ?? "",
    name:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null,
  });
  if (insertError) {
    console.error("[ensurePublicUser] insert failed", {
      userId: user.id,
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
    });
    return { ok: false, error: insertError.message };
  }
  return { ok: true };
}
