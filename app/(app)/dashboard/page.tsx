import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  FileText,
  Link2,
  Mail,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerT } from "@/lib/i18n/server";
import { getCurrentProfile } from "@/lib/profile";
import {
  COVER_LETTER_MIN_COMPLETENESS,
  computeCompleteness,
  formStateFromRow,
  type ProfileFormState,
} from "@/lib/profile-form";
import { createClient } from "@/lib/supabase/server";
import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AnimatedStatTile } from "./animated-stat-tile";

type T = (key: string, vars?: Record<string, string | number>) => string;

// Row shapes — only the columns we actually use are selected, so the
// rest of each table doesn't matter to TypeScript.
interface JobRow {
  id: string;
  status: JobStatus;
  company: string;
  position: string;
  created_at: string;
}
interface SavedLetterRow {
  id: string;
  job_title: string | null;
  company_name: string | null;
  created_at: string;
}
interface WorkLinkRow {
  id: string;
  url: string;
  type: string;
  status: string;
  created_at: string;
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const { t } = await getServerT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS scopes every query to the current user. We use saved_cover_letters
  // (the user's curated library) for the dashboard count — NOT cover_letters,
  // which is the auto-log of every generation. Showing 14 generations when the
  // user only saved 1 was the bug.
  const [jobsRes, savedLettersRes, cvsRes, workLinksRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, status, company, position, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("saved_cover_letters")
      .select("id, job_title, company_name, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("resumes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("work_links")
      .select("id, url, type, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const jobs = (jobsRes.data ?? []) as JobRow[];
  const savedLetters = (savedLettersRes.data ?? []) as SavedLetterRow[];
  const cvCount = cvsRes.count ?? 0;
  const workLinks = (workLinksRes.data ?? []) as WorkLinkRow[];
  const readyLinksCount = workLinks.filter((l) => l.status === "ready").length;

  const pipeline: Record<JobStatus, number> = {
    saved: 0,
    applied: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
  };
  for (const j of jobs) {
    if (j.status in pipeline) pipeline[j.status]++;
  }
  const activeApplications =
    pipeline.applied + pipeline.interview + pipeline.offer;

  const formState = formStateFromRow(profile);
  const completeness = computeCompleteness(formState);

  const missingItems = computeMissingItems(formState, t);
  const suggestions = computeSuggestions(formState, savedLetters.length, t);
  const activities = buildActivities(savedLetters, jobs, t).slice(0, 6);

  const firstName =
    profile.full_name?.trim().split(/\s+/)[0] ||
    t("dashboard.greeting.fallback_name");
  const greeting = pickGreeting(t);

  const todayLong = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 sm:px-8">
      {/* ============================================================
          Greeting header — clean sans, friendly, no masthead.
          ============================================================ */}
      <header className="reveal">
        <p className="text-label uppercase tracking-wide text-muted-foreground">
          {todayLong}
        </p>
        <h1 className="mt-1 text-h1 font-semibold tracking-[-0.02em] text-foreground">
          {greeting}, {firstName}.
        </h1>
        <p className="mt-2 max-w-[52ch] text-body text-muted-foreground">
          {t("dashboard.greeting.subtitle")}
        </p>
      </header>

      {/* ============================================================
          Stat cards — number + label + optional trend.
          ============================================================ */}
      <div className="reveal mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <AnimatedStatTile
          label={t("dashboard.stats.saved_letters")}
          value={savedLetters.length}
          icon={<Mail className="h-[18px] w-[18px]" />}
          accent="primary"
          href="/cover-letters"
        />
        <AnimatedStatTile
          label={t("dashboard.stats.in_progress")}
          value={activeApplications}
          icon={<Briefcase className="h-[18px] w-[18px]" />}
          accent="primary"
          href="/jobs"
        />
        <AnimatedStatTile
          label={t("dashboard.stats.portfolio_links")}
          value={readyLinksCount}
          icon={<Link2 className="h-[18px] w-[18px]" />}
          accent="primary"
          href="/portfolio"
        />
        <AnimatedStatTile
          label={t("dashboard.stats.cvs")}
          value={cvCount}
          icon={<FileText className="h-[18px] w-[18px]" />}
          accent="primary"
          href="/cvs"
        />
      </div>

      {/* ============================================================
          Two-column body — left: actions & activity, right: health,
          pipeline, AI insights.
          ============================================================ */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="reveal space-y-6">
          <QuickActionsSection t={t} />
          <RecentActivitySection activities={activities} t={t} />
        </div>
        <aside className="reveal space-y-6">
          <ProfileHealthSection
            completeness={completeness}
            threshold={COVER_LETTER_MIN_COMPLETENESS}
            missing={missingItems}
            t={t}
          />
          <JobPipelineSection pipeline={pipeline} total={jobs.length} t={t} />
          {suggestions.length > 0 && (
            <SmartSuggestionsSection suggestions={suggestions} t={t} />
          )}
        </aside>
      </div>
    </div>
  );
}

// ===================================================================
// Quick actions
// ===================================================================

function QuickActionsSection({ t }: { t: T }) {
  return (
    <section>
      <SectionLabel>{t("dashboard.quick_actions.title")}</SectionLabel>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ActionCard
          icon={<Mail className="h-[18px] w-[18px]" />}
          title={t("dashboard.quick_actions.write_letter.title")}
          body={t("dashboard.quick_actions.write_letter.body")}
          openLabel={t("dashboard.quick_actions.open")}
          href="/cover-letters/new"
        />
        <ActionCard
          icon={<Briefcase className="h-[18px] w-[18px]" />}
          title={t("dashboard.quick_actions.track_application.title")}
          body={t("dashboard.quick_actions.track_application.body")}
          openLabel={t("dashboard.quick_actions.open")}
          href="/jobs"
        />
        <ActionCard
          icon={<Link2 className="h-[18px] w-[18px]" />}
          title={t("dashboard.quick_actions.add_portfolio.title")}
          body={t("dashboard.quick_actions.add_portfolio.body")}
          openLabel={t("dashboard.quick_actions.open")}
          href="/portfolio"
        />
        <ActionCard
          icon={<Wand2 className="h-[18px] w-[18px]" />}
          title={t("dashboard.quick_actions.polish_profile.title")}
          body={t("dashboard.quick_actions.polish_profile.body")}
          openLabel={t("dashboard.quick_actions.open")}
          href="/settings/profile"
        />
      </div>
    </section>
  );
}

function ActionCard({
  icon,
  title,
  body,
  openLabel,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  openLabel: string;
  href: Route;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-xl border border-border bg-surface p-5 shadow-sm",
        "transition-[transform,box-shadow,border-color] duration-150 ease-out",
        "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-primary">
        {icon}
      </span>
      <div className="mt-3 text-body font-semibold tracking-[-0.01em] text-foreground">
        {title}
      </div>
      <p className="mt-1 max-w-[42ch] text-small text-muted-foreground">
        {body}
      </p>
      <span className="mt-3 inline-flex items-center gap-1 text-small font-medium text-primary opacity-80 transition-opacity duration-150 group-hover:opacity-100">
        {openLabel}
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

// ===================================================================
// Profile health
// ===================================================================

function ProfileHealthSection({
  completeness,
  threshold,
  missing,
  t,
}: {
  completeness: number;
  threshold: number;
  missing: { label: string }[];
  t: T;
}) {
  const reachable = completeness >= threshold;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.profile_health.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-[40px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-foreground">
            {completeness}
            <span className="text-[22px] text-muted-foreground">%</span>
          </span>
          <span className="text-small font-medium text-muted-foreground">
            {t("dashboard.profile_health.strength")}
          </span>
        </div>

        {/* Progress bar. */}
        <div className="h-2 overflow-hidden rounded-full bg-surface-elevated">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-slow ease-out",
              reachable ? "bg-success" : "bg-primary",
            )}
            style={{ width: `${Math.min(completeness, 100)}%` }}
          />
        </div>

        {!reachable && (
          <p className="text-small text-muted-foreground">
            {t("dashboard.profile_health.unlock_hint", { threshold })}
          </p>
        )}

        {missing.length > 0 ? (
          <div className="space-y-2">
            <div className="text-label uppercase tracking-wide text-muted-foreground">
              {t("dashboard.profile_health.improve")}
            </div>
            <ul className="space-y-1">
              {missing.map((m) => (
                <li key={m.label}>
                  <Link
                    href="/settings/profile"
                    className={cn(
                      "group flex items-center justify-between gap-3 rounded-lg px-2.5 py-2",
                      "text-small text-foreground",
                      "transition-colors duration-150 hover:bg-surface-elevated",
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {m.label}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-small text-success">
            {t("dashboard.profile_health.all_good")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ===================================================================
// Recent activity
// ===================================================================

function RecentActivitySection({
  activities,
  t,
}: {
  activities: ActivityItem[];
  t: T;
}) {
  return (
    <section>
      <SectionLabel>{t("dashboard.recent_activity.title")}</SectionLabel>
      <Card className="mt-4 overflow-hidden">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-primary">
              <Sparkles className="h-[18px] w-[18px]" />
            </span>
            <p className="max-w-[40ch] text-small text-muted-foreground">
              {t("dashboard.recent_activity.empty")}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {activities.map((a, i) => {
              const href: Route =
                a.kind === "cover_letter" ? "/cover-letters" : "/jobs";
              return (
                <li key={`${a.kind}-${a.at}-${i}`}>
                  <Link
                    href={href}
                    className={cn(
                      "group flex items-center gap-3 px-4 py-3",
                      "transition-colors duration-150 hover:bg-surface-elevated",
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-primary">
                      {a.kind === "cover_letter" ? (
                        <Mail className="h-4 w-4" />
                      ) : (
                        <Briefcase className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-small font-medium text-foreground">
                        {a.title}
                      </div>
                    </div>
                    <span className="hidden shrink-0 text-label tabular-nums text-muted-foreground sm:inline">
                      {formatRelative(a.at, t)}
                    </span>
                    <ArrowUpRight
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground",
                        "opacity-0 -translate-x-1",
                        "transition-all duration-150 ease-out",
                        "group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-foreground",
                      )}
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}

// ===================================================================
// Job pipeline
// ===================================================================

function JobPipelineSection({
  pipeline,
  total,
  t,
}: {
  pipeline: Record<JobStatus, number>;
  total: number;
  t: T;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle>{t("dashboard.pipeline.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-border bg-border">
          <PipelineColumn
            label={t("dashboard.pipeline.saved")}
            count={pipeline.saved}
          />
          <PipelineColumn
            label={t("dashboard.pipeline.applied")}
            count={pipeline.applied}
            accent
          />
          <PipelineColumn
            label={t("dashboard.pipeline.interview")}
            count={pipeline.interview}
            accent
          />
          <PipelineColumn
            label={t("dashboard.pipeline.offer")}
            count={pipeline.offer}
            accent
          />
        </div>
        <Link
          href="/jobs"
          className="group mt-4 flex items-center justify-between"
        >
          <span className="text-small text-muted-foreground">
            {t("dashboard.pipeline.total", { count: total })}
          </span>
          <span className="inline-flex items-center gap-1 text-small font-medium text-primary opacity-80 transition-opacity duration-150 group-hover:opacity-100">
            {t("dashboard.pipeline.open")}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </span>
        </Link>
      </CardContent>
    </Card>
  );
}

function PipelineColumn({
  label,
  count,
  accent,
}: {
  label: string;
  count: number;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center bg-surface px-2 py-3">
      <div
        className={cn(
          "text-[26px] font-semibold leading-none tabular-nums tracking-[-0.02em]",
          accent && count > 0 ? "text-primary" : "text-foreground",
        )}
      >
        {count}
      </div>
      <div className="mt-1.5 text-label text-muted-foreground">{label}</div>
    </div>
  );
}

// ===================================================================
// Smart suggestions (AI insights)
// ===================================================================

function SmartSuggestionsSection({
  suggestions,
  t,
}: {
  suggestions: Suggestion[];
  t: T;
}) {
  return (
    <section>
      <SectionLabel>
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t("dashboard.suggestions.title")}
        </span>
      </SectionLabel>
      <ul className="mt-4 space-y-3">
        {suggestions.map((s) => (
          <li key={s.title}>
            <Link
              href={s.href}
              className={cn(
                "group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm",
                "transition-[transform,box-shadow,border-color] duration-150 ease-out",
                "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-small font-semibold tracking-[-0.005em] text-foreground">
                  {s.title}
                </div>
                <p className="mt-1 text-small text-muted-foreground">
                  {s.body}
                </p>
              </div>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ===================================================================
// Shared section label — clean uppercase eyebrow.
// ===================================================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-label uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

// ===================================================================
// Helpers
// ===================================================================

interface Suggestion {
  title: string;
  body: string;
  href: Route;
}

interface ActivityItem {
  kind: "cover_letter" | "job";
  at: string;
  title: string;
}

function pickGreeting(t: T): string {
  const hour = new Date().getHours();
  if (hour < 5) return t("dashboard.greeting.working_late");
  if (hour < 12) return t("dashboard.greeting.morning");
  if (hour < 18) return t("dashboard.greeting.afternoon");
  return t("dashboard.greeting.evening");
}

function computeMissingItems(s: ProfileFormState, t: T): { label: string }[] {
  const items: { label: string }[] = [];
  if (!s.portfolio_url.trim())
    items.push({ label: t("dashboard.profile_health.missing.portfolio") });
  if (s.skills.length < 8) {
    if (s.skills.length === 0) {
      items.push({
        label: t("dashboard.profile_health.missing.skills_first"),
      });
    } else {
      const remaining = 8 - s.skills.length;
      items.push({
        label: t(
          remaining === 1
            ? "dashboard.profile_health.missing.skills_more_one"
            : "dashboard.profile_health.missing.skills_more_other",
          { count: remaining },
        ),
      });
    }
  }
  if (s.professional_summary.trim().length < 200)
    items.push({ label: t("dashboard.profile_health.missing.summary") });
  if (s.target_industries.length === 0)
    items.push({ label: t("dashboard.profile_health.missing.industries") });
  if (s.tools.length === 0)
    items.push({ label: t("dashboard.profile_health.missing.tools") });
  return items.slice(0, 4);
}

function computeSuggestions(
  s: ProfileFormState,
  savedLettersCount: number,
  t: T,
): Suggestion[] {
  const out: Suggestion[] = [];
  if (savedLettersCount === 0) {
    out.push({
      title: t("dashboard.suggestions.first_letter.title"),
      body: t("dashboard.suggestions.first_letter.body"),
      href: "/cover-letters/new",
    });
  }
  if (!s.portfolio_url.trim()) {
    out.push({
      title: t("dashboard.suggestions.add_portfolio.title"),
      body: t("dashboard.suggestions.add_portfolio.body"),
      href: "/settings/profile",
    });
  }
  if (s.professional_summary.trim().length < 200) {
    out.push({
      title: t("dashboard.suggestions.strengthen_summary.title"),
      body: t("dashboard.suggestions.strengthen_summary.body"),
      href: "/settings/profile",
    });
  }
  return out.slice(0, 3);
}

function buildActivities(
  savedLetters: SavedLetterRow[],
  jobs: JobRow[],
  t: T,
): ActivityItem[] {
  const out: ActivityItem[] = [];
  for (const l of savedLetters) {
    const target = [l.company_name, l.job_title].filter(Boolean).join(" — ");
    out.push({
      kind: "cover_letter",
      at: l.created_at,
      title: target
        ? t("dashboard.recent_activity.saved_letter_with_target", { target })
        : t("dashboard.recent_activity.saved_letter"),
    });
  }
  for (const j of jobs) {
    out.push({
      kind: "job",
      at: j.created_at,
      title: t("dashboard.recent_activity.added_job", {
        company: j.company,
        position: j.position,
      }),
    });
  }
  out.sort((a, b) => b.at.localeCompare(a.at));
  return out;
}

function formatRelative(iso: string, t: T): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return t("dashboard.recent_activity.just_now");
  if (m < 60) return t("dashboard.recent_activity.minutes_ago", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("dashboard.recent_activity.hours_ago", { count: h });
  const d = Math.floor(h / 24);
  if (d < 7) return t("dashboard.recent_activity.days_ago", { count: d });
  // Beyond a week, defer to the platform's locale-aware formatter.
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
