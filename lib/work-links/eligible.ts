// Shared loader for the links a cover letter may reference: the user's
// "use in cover letter"-enabled, ready, non-blocked work links. Used by the
// cover-letter API route (to build the prompt) and by the cover-letter page
// (to populate the link multiselect) so both see the exact same set.

import type { createClient } from "@/lib/supabase/server";
import { scoreLink } from "./quality";
import type { WorkLinkRow } from "./types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface EligibleLink {
  url: string;
  type: string;
  title: string | null;
  summary: string | null;
  cover_letter_hint: string | null;
}

export async function loadEligibleCoverLetterLinks(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<EligibleLink[]> {
  const { data } = await supabase
    .from("work_links")
    .select(
      "id, user_id, url, type, title, summary, cover_letter_hint, thumbnail_url, status, use_in_cover_letter, quality_signals, last_checked_at, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("status", "ready")
    .eq("use_in_cover_letter", true)
    .order("created_at", { ascending: false })
    .limit(20);
  return ((data ?? []) as WorkLinkRow[])
    .filter((row) => !scoreLink(row).blocked)
    .slice(0, 6)
    .map((row) => ({
      url: row.url,
      type: row.type,
      title: row.title,
      summary: row.summary,
      cover_letter_hint: row.cover_letter_hint,
    }));
}
