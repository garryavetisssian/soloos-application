import { redirect } from "next/navigation";
import {
  Folder,
  GitBranch,
  Globe,
  Lightbulb,
  PencilLine,
  Plus,
} from "lucide-react";
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
    <div className="mx-auto flex max-w-[1080px] flex-col px-6 py-8 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-h1 tracking-tight">{tt("title")}</h1>
          <p className="pt-1 text-body text-secondary-foreground">
            {tt("subtitle")}
          </p>
        </div>
      </header>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-h3 tracking-tight">{tt("how_it_works.title")}</h2>
        <p className="pt-1 text-small text-muted-foreground">
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
        <p className="pt-5 text-small text-muted-foreground">
          <strong className="text-foreground">{tt("public_only.label")}</strong>{" "}
          {tt("public_only.body")}
        </p>

        {/* Tips for better results — one paragraph per source-type that
            explains specifically what the user can do to maximise what
            SoloOS extracts. Useful for the cases (sparse Figma cover,
            generic frame names, README-light GitHub repos) where the
            auto-summary alone falls short. */}
        <div className="mt-6 rounded-xl border border-border bg-surface-elevated/30 p-4">
          <h3 className="inline-flex items-center gap-2 text-small font-medium text-foreground">
            <Lightbulb className="h-3.5 w-3.5 text-primary" />
            {tt("tips.title")}
          </h3>
          <ul className="mt-3 space-y-2 text-small text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>{tt("tips.figma_thumbnail")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>{tt("tips.figma_naming")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>{tt("tips.github_readme")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>{tt("tips.edit_summary")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>{tt("tips.quality_bar")}</span>
            </li>
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
    <div className="rounded-xl border border-border bg-surface-elevated/40 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-elevated text-muted-foreground">
          {icon}
        </span>
        <h3 className="text-small font-medium text-foreground">{title}</h3>
      </div>
      <p className="pt-2 text-small text-muted-foreground">{body}</p>
    </div>
  );
}
