import { redirect } from "next/navigation";
import {
  Folder,
  GitBranch,
  Globe,
  Lightbulb,
  PencilLine,
  Plus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { getServerT } from "@/lib/i18n/server";
import { getCurrentProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { WorkLinkRow } from "@/lib/work-links/types";
import { PortfolioList } from "./portfolio-list";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("work_links")
    .select(
      "id, user_id, url, type, title, summary, cover_letter_hint, thumbnail_url, status, use_in_cover_letter, quality_signals, last_checked_at, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[portfolio] fetch failed", error);
  }
  const links = (data ?? []) as WorkLinkRow[];

  const { t } = await getServerT();
  const tt = (key: string, vars?: Record<string, string | number>) =>
    t(`portfolio.${key}`, vars);

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col px-6 py-10 sm:px-10">
      <header className="animate-fade-in">
        <h1 className="text-h1 font-semibold text-foreground">{tt("title")}</h1>
        <p className="mt-2 max-w-[64ch] text-body text-muted-foreground">
          {tt("subtitle")}
        </p>
      </header>

      {/* How it works — a clean primer card. */}
      <section className="mt-8">
        <h2 className="text-h3 font-semibold text-foreground">
          {tt("how_it_works.title")}
        </h2>
        <p className="mt-2 max-w-[72ch] text-small text-muted-foreground">
          {tt("how_it_works.body")}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ExampleCard
            icon={<Globe className="h-4 w-4" />}
            title={tt("examples.portfolio_title")}
            body={tt("examples.portfolio_body")}
          />
          <ExampleCard
            icon={<GitBranch className="h-4 w-4" />}
            title={tt("examples.github_title")}
            body={tt("examples.github_body")}
          />
          <ExampleCard
            icon={<Folder className="h-4 w-4" />}
            title={tt("examples.figma_title")}
            body={tt("examples.figma_body")}
          />
          <ExampleCard
            icon={<PencilLine className="h-4 w-4" />}
            title={tt("examples.article_title")}
            body={tt("examples.article_body")}
          />
          <ExampleCard
            icon={<Plus className="h-4 w-4" />}
            title={tt("examples.app_title")}
            body={tt("examples.app_body")}
          />
        </div>

        <p className="mt-4 text-small text-muted-foreground">
          <span className="font-medium text-foreground">
            {tt("public_only.label")}
          </span>{" "}
          {tt("public_only.body")}
        </p>

        {/* Tips — soft accent callout. */}
        <div className="mt-6 rounded-xl border border-border bg-accent-soft p-5">
          <h3 className="inline-flex items-center gap-2 text-label font-medium uppercase tracking-wide text-primary">
            <Lightbulb className="h-3.5 w-3.5" />
            {tt("tips.title")}
          </h3>
          <ul className="mt-3 space-y-2 text-small text-foreground">
            {[
              "figma_thumbnail",
              "figma_naming",
              "github_readme",
              "edit_summary",
              "quality_bar",
            ].map((k) => (
              <li key={k} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70"
                />
                <span>{tt(`tips.${k}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <PortfolioList links={links} />
    </div>
  );
}

function ExampleCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface-elevated text-muted-foreground">
          {icon}
        </span>
        <h3 className="text-small font-medium text-foreground">{title}</h3>
      </div>
      <p className="pt-2 text-small text-muted-foreground">{body}</p>
    </Card>
  );
}
