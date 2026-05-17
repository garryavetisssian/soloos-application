import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getServerT } from "@/lib/i18n/server";
import { getCurrentProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { LibraryToolbar, LibraryGrid } from "./library-grid";
import type { SavedLetterRow } from "./library-types";

export const dynamic = "force-dynamic";

export default async function CoverLettersLibraryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS scopes the query to the current user; the explicit eq is a
  // defence-in-depth check in case a future policy edit weakens that.
  const { data, error } = await supabase
    .from("saved_cover_letters")
    .select(
      "id, content, job_title, company_name, language, source_type, source_url, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[cover-letters/library] fetch failed", error);
  }
  const letters = (data ?? []) as SavedLetterRow[];

  const { t } = await getServerT();
  const tt = (key: string) => t(`cover_letter.${key}`);

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col px-6 py-8 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 tracking-tight">
            {tt("library.title")}
          </h1>
          <p className="pt-1 text-body text-secondary-foreground">
            {tt("library.subtitle")}
          </p>
        </div>
        {letters.length > 0 && (
          <Button asChild>
            <Link href="/cover-letters/new">
              <Plus className="h-4 w-4" />
              {tt("library.new_button")}
            </Link>
          </Button>
        )}
      </header>

      {letters.length === 0 ? (
        <EmptyState
          title={tt("library.empty.title")}
          body={tt("library.empty.body")}
          ctaLabel={tt("library.empty.cta")}
        />
      ) : (
        <div className="mt-8 space-y-5">
          <LibraryToolbar count={letters.length} />
          <LibraryGrid letters={letters} />
        </div>
      )}
    </div>
  );
}

function EmptyState({
  title,
  body,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaLabel: string;
}) {
  return (
    <section className="mt-10 flex flex-col items-center justify-center gap-5 rounded-[24px] border border-dashed border-border bg-surface p-14 text-center">
      <div className="relative">
        <span className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-primary/30 via-violet-500/20 to-cyan-500/20 blur-2xl" />
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-elevated text-primary ring-1 ring-primary/20">
          <Mail className="h-7 w-7" />
        </span>
      </div>
      <div className="space-y-1.5">
        <h2 className="text-h2 tracking-tight">{title}</h2>
        <p className="max-w-[420px] text-body text-secondary-foreground">
          {body}
        </p>
      </div>
      <Button asChild size="lg">
        <Link href="/cover-letters/new">
          <Plus className="h-4 w-4" />
          {ctaLabel}
        </Link>
      </Button>
    </section>
  );
}
