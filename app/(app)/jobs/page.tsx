import { JobsBoard } from "@/components/workspace/jobs-board";
import { createClient } from "@/lib/supabase/server";
export default async function JobsPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data, error } = await db.from("saved_cover_letters").select("id,job_title,company_name").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500);
  return <JobsBoard lettersError={!!error} letters={(data || []).map(row => ({ id: row.id, label: [row.company_name, row.job_title].filter(Boolean).join(" — ") || row.id }))} />;
}
