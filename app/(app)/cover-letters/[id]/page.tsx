import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getServerT } from "@/lib/i18n/server";
import type { JobResearch } from "@/lib/job-research/types";
import { createClient } from "@/lib/supabase/server";
import { LetterDetailEditor } from "./letter-detail-editor";

export const dynamic = "force-dynamic";

interface SavedLetterDetail {
  id: string;
  content: string;
  job_title: string | null;
  company_name: string | null;
  language: "English" | "Russian" | "Armenian" | null;
  source_type: "manual" | "job_link" | null;
  source_url: string | null;
  job_description: string | null;
  job_research: JobResearch | null;
  channel: "platform" | "direct" | null;
  recipient_name: string | null;
  created_at: string;
  updated_at: string | null;
}

export default async function SavedLetterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("saved_cover_letters")
    .select(
      "id, content, job_title, company_name, language, source_type, source_url, job_description, job_research, channel, recipient_name, created_at, updated_at",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[cover-letters/detail] fetch failed", error);
  }
  if (!data) notFound();
  const letter = data as SavedLetterDetail;

  const { t } = await getServerT();
  const tt = (key: string) => t(`cover_letter.${key}`);

  return (
    <div className="mx-auto flex max-w-[920px] flex-col px-6 py-8 sm:px-8">
      <header>
        <Link
          href="/cover-letters"
          className="inline-flex items-center gap-1.5 text-small text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {tt("library.back_to_library")}
        </Link>
      </header>

      <LetterDetailEditor letter={letter} />
    </div>
  );
}
