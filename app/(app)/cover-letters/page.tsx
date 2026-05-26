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
    <div className="mx-auto flex max-w-[1280px] flex-col px-6 py-10 sm:px-10">
      <header className="animate-fade-in">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-h1 font-semibold tracking-[-0.02em] text-foreground">
              {tt("library.title")}
            </h1>
            <p className="mt-2 max-w-[58ch] text-body text-muted-foreground">
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
        </div>
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
    <section className="mt-10 flex flex-col items-center rounded-xl border border-border bg-surface px-6 py-16 text-center shadow-sm sm:px-16">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-primary">
        <Mail className="h-6 w-6" />
      </span>
      <h2 className="mt-5 text-h2 font-semibold tracking-[-0.015em] text-foreground">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-[44ch] text-body text-muted-foreground">
        {body}
      </p>
      <div className="mt-6">
        <Button asChild size="lg">
          <Link href="/cover-letters/new">
            <Plus className="h-4 w-4" />
            {ctaLabel}
          </Link>
        </Button>
      </div>
    </section>
  );
}
