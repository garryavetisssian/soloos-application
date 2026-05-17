import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import {
  ArrowRight,
  Briefcase,
  FileText,
  Heart,
  Link2,
  Mail,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
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
import {
  AnimatedStatTile,
  type StatAccent,
} from "./animated-stat-tile";

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

  const missingItems = computeMissingItems(formState);
  const suggestions = computeSuggestions(formState, savedLetters.length);
  const activities = buildActivities(savedLetters, jobs).slice(0, 6);

  const firstName = profile.full_name?.trim().split(/\s+/)[0] || "there";
  const greeting = pickGreeting();

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8 sm:px-8">
      {/* ---- Hero ---- */}
      <section className="reveal space-y-6">
        <header>
          <h1 className="text-h1 font-semibold tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="pt-1.5 text-body text-secondary-foreground">
            Here&apos;s what&apos;s moving in your career today.
          </p>
        </header>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <AnimatedStatTile
            label="Saved letters"
            value={savedLetters.length}
            icon={<Mail className="h-4 w-4" />}
            accent="violet"
          />
          <AnimatedStatTile
            label="In progress"
            value={activeApplications}
            icon={<Briefcase className="h-4 w-4" />}
            accent="cyan"
          />
          <AnimatedStatTile
            label="Portfolio links"
            value={readyLinksCount}
            icon={<Link2 className="h-4 w-4" />}
            accent="emerald"
          />
          <AnimatedStatTile
            label="CVs"
            value={cvCount}
            icon={<FileText className="h-4 w-4" />}
            accent="primary"
          />
        </div>
      </section>

      {/* ---- Main grid ---- */}
      <div className="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <QuickActionsSection />
          <RecentActivitySection activities={activities} />
        </div>
        <aside className="space-y-6">
          <ProfileHealthSection
            completeness={completeness}
            threshold={COVER_LETTER_MIN_COMPLETENESS}
            missing={missingItems}
          />
          <JobPipelineSection pipeline={pipeline} total={jobs.length} />
          {suggestions.length > 0 && (
            <SmartSuggestionsSection suggestions={suggestions} />
          )}
        </aside>
      </div>
    </div>
  );
}

// ===================================================================
// Quick actions
// ===================================================================

function QuickActionsSection() {
  return (
    <section className="space-y-4">
      <SectionHeader title="Quick actions" />
      <div className="grid gap-3 sm:grid-cols-2">
        <ActionCard
          icon={<Mail className="h-5 w-5" />}
          accent="violet"
          title="Write a cover letter"
          body="Paste a job link or description — get a tailored letter in seconds."
          href="/cover-letters/new"
          highlighted
        />
        <ActionCard
          icon={<Briefcase className="h-5 w-5" />}
          accent="cyan"
          title="Track an application"
          body="Move applications through Saved → Applied → Interview → Offer."
          href="/jobs"
        />
        <ActionCard
          icon={<Link2 className="h-5 w-5" />}
          accent="emerald"
          title="Add a portfolio link"
          body="GitHub, Figma, article, App Store. We&rsquo;ll summarize it for you."
          href="/portfolio"
        />
        <ActionCard
          icon={<Wand2 className="h-5 w-5" />}
          accent="primary"
          title="Polish your profile"
          body="Stronger profile makes every AI letter more specific."
          href="/settings/profile"
        />
      </div>
    </section>
  );
}

const ACTION_ACCENT: Record<
  StatAccent,
  { gradient: string; text: string; iconBg: string; ring: string }
> = {
  primary: {
    gradient: "from-primary/14 via-transparent to-primary/5",
    text: "text-primary",
    iconBg: "bg-primary/15",
    ring: "ring-primary/30",
  },
  cyan: {
    gradient: "from-cyan-500/14 via-transparent to-cyan-500/5",
    text: "text-cyan-400",
    iconBg: "bg-cyan-500/15",
    ring: "ring-cyan-500/30",
  },
  violet: {
    gradient: "from-violet-500/14 via-transparent to-fuchsia-500/5",
    text: "text-violet-400",
    iconBg: "bg-violet-500/15",
    ring: "ring-violet-500/30",
  },
  emerald: {
    gradient: "from-emerald-500/14 via-transparent to-cyan-500/5",
    text: "text-emerald-400",
    iconBg: "bg-emerald-500/15",
    ring: "ring-emerald-500/30",
  },
};

function ActionCard({
  icon,
  accent,
  title,
  body,
  href,
  highlighted,
}: {
  icon: React.ReactNode;
  accent: StatAccent;
  title: string;
  body: string;
  href: Route;
  highlighted?: boolean;
}) {
  const a = ACTION_ACCENT[accent];
  return (
    <Link
      href={href}
      className={cn(
        "glass-card group relative p-5 lift-on-hover",
        highlighted && "ring-1",
        highlighted && a.ring,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br opacity-40 transition-opacity duration-medium group-hover:opacity-90",
          a.gradient,
        )}
      />
      <div className="relative space-y-3">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl ring-1",
            a.iconBg,
            a.text,
            a.ring,
          )}
        >
          {icon}
        </span>
        <div>
          <div className="text-body font-medium text-foreground">{title}</div>
          <p className="mt-1 text-small text-muted-foreground">{body}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-small font-medium text-primary opacity-0 transition-opacity duration-fast group-hover:opacity-100">
          Open
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
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
}: {
  completeness: number;
  threshold: number;
  missing: { label: string }[];
}) {
  const reachable = completeness >= threshold;
  const gradientFromTo = reachable
    ? "from-success to-emerald-400"
    : "from-warning to-primary";
  return (
    <section className="space-y-4">
      <SectionHeader title="Profile health" icon={<Heart className="h-3.5 w-3.5" />} />
      <div className="glass-card relative overflow-hidden p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-small uppercase tracking-wide text-muted-foreground">
              Strength
            </div>
            <div className="mt-1 text-hero font-semibold tabular-nums tracking-tight">
              {completeness}%
            </div>
          </div>
          <span
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl",
              reachable
                ? "bg-success/15 text-success ring-1 ring-success/30"
                : "bg-warning/15 text-warning ring-1 ring-warning/30",
            )}
          >
            <Heart className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r transition-[width] duration-slow ease-out-quint",
              gradientFromTo,
            )}
            style={{ width: `${Math.min(completeness, 100)}%` }}
          />
        </div>
        {!reachable && (
          <p className="mt-3 text-small text-muted-foreground">
            Unlock AI cover letters at {threshold}%.
          </p>
        )}
        {missing.length > 0 ? (
          <div className="mt-5">
            <div className="text-small uppercase tracking-wide text-muted-foreground">
              Improve
            </div>
            <ul className="mt-2 space-y-0.5">
              {missing.map((m) => (
                <li key={m.label}>
                  <Link
                    href="/settings/profile"
                    className={cn(
                      "-mx-2 flex items-center justify-between rounded-md px-2 py-1.5 text-small",
                      "text-secondary-foreground transition-colors duration-fast",
                      "hover:bg-surface-elevated/70 hover:text-foreground",
                    )}
                  >
                    <span>{m.label}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-5 text-small text-muted-foreground">
            Profile looks great. Every section is filled.
          </p>
        )}
      </div>
    </section>
  );
}

// ===================================================================
// Recent activity
// ===================================================================

function RecentActivitySection({ activities }: { activities: ActivityItem[] }) {
  return (
    <section className="space-y-4">
      <SectionHeader title="Recent activity" />
      <div className="glass-card p-5">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-elevated text-muted-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <p className="text-small text-muted-foreground">
              No activity yet. Save your first cover letter or add a job.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {activities.map((a, i) => (
              <li key={`${a.kind}-${a.at}-${i}`} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                    a.kind === "cover_letter"
                      ? "bg-violet-500/15 text-violet-400"
                      : "bg-cyan-500/15 text-cyan-400",
                  )}
                >
                  {a.kind === "cover_letter" ? (
                    <Mail className="h-3.5 w-3.5" />
                  ) : (
                    <Briefcase className="h-3.5 w-3.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-small text-foreground">
                    {a.title}
                  </div>
                  <div className="text-small text-muted-foreground">
                    {formatRelative(a.at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ===================================================================
// Job pipeline
// ===================================================================

function JobPipelineSection({
  pipeline,
  total,
}: {
  pipeline: Record<JobStatus, number>;
  total: number;
}) {
  return (
    <section className="space-y-4">
      <SectionHeader title="Job pipeline" icon={<Briefcase className="h-3.5 w-3.5" />} />
      <Link
        href="/jobs"
        className="glass-card group block p-5 lift-on-hover"
      >
        <div className="grid grid-cols-4 gap-2">
          <PipelineColumn label="Saved" count={pipeline.saved} />
          <PipelineColumn label="Applied" count={pipeline.applied} accent="cyan" />
          <PipelineColumn label="Interview" count={pipeline.interview} accent="primary" />
          <PipelineColumn label="Offer" count={pipeline.offer} accent="emerald" />
        </div>
        <div className="mt-4 flex items-center justify-between text-small">
          <span className="text-muted-foreground">{total} total</span>
          <span className="inline-flex items-center gap-1 text-primary opacity-80 transition-opacity duration-fast group-hover:opacity-100">
            Open pipeline
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </Link>
    </section>
  );
}

function PipelineColumn({
  label,
  count,
  accent,
}: {
  label: string;
  count: number;
  accent?: "primary" | "cyan" | "emerald";
}) {
  const tint =
    accent === "cyan"
      ? "text-cyan-400"
      : accent === "primary"
        ? "text-primary"
        : accent === "emerald"
          ? "text-emerald-400"
          : "text-foreground";
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-3">
      <div className={cn("text-h2 font-semibold tabular-nums tracking-tight", tint)}>
        {count}
      </div>
      <div className="pt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

// ===================================================================
// Smart suggestions
// ===================================================================

function SmartSuggestionsSection({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  return (
    <section className="space-y-4">
      <SectionHeader title="Try next" icon={<Sparkles className="h-3.5 w-3.5" />} />
      <ul className="space-y-2">
        {suggestions.map((s) => (
          <li key={s.title}>
            <Link
              href={s.href}
              className={cn(
                "glass-card group flex items-start gap-3 p-4 lift-on-hover",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-small font-medium text-foreground">
                  {s.title}
                </div>
                <p className="mt-0.5 text-small text-muted-foreground">
                  {s.body}
                </p>
              </div>
              <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-colors duration-fast group-hover:text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ===================================================================
// Section header
// ===================================================================

function SectionHeader({
  icon,
  title,
}: {
  icon?: React.ReactNode;
  title: string;
}) {
  return (
    <header className="flex items-center gap-2">
      {icon && (
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-elevated text-muted-foreground">
          {icon}
        </span>
      )}
      <h2 className="text-h3 font-semibold tracking-tight">{title}</h2>
    </header>
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

function pickGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function computeMissingItems(s: ProfileFormState): { label: string }[] {
  const items: { label: string }[] = [];
  if (!s.portfolio_url.trim()) items.push({ label: "Add portfolio link" });
  if (s.skills.length < 8)
    items.push({
      label:
        s.skills.length === 0
          ? "Add your first skills"
          : `Add ${8 - s.skills.length} more skill${
              8 - s.skills.length === 1 ? "" : "s"
            }`,
    });
  if (s.professional_summary.trim().length < 200)
    items.push({ label: "Improve professional summary" });
  if (s.target_industries.length === 0)
    items.push({ label: "Add target industries" });
  if (s.tools.length === 0) items.push({ label: "Add tools you use" });
  return items.slice(0, 4);
}

function computeSuggestions(
  s: ProfileFormState,
  savedLettersCount: number,
): Suggestion[] {
  const out: Suggestion[] = [];
  if (savedLettersCount === 0) {
    out.push({
      title: "Generate your first cover letter",
      body: "Paste a job link — SoloOS extracts company context and writes a tailored letter.",
      href: "/cover-letters/new",
    });
  }
  if (!s.portfolio_url.trim()) {
    out.push({
      title: "Add your portfolio",
      body: "Cover letters become more specific when SoloOS can reference your work.",
      href: "/settings/profile",
    });
  }
  if (s.professional_summary.trim().length < 200) {
    out.push({
      title: "Strengthen your summary",
      body: "A richer professional summary lets the AI position you more clearly.",
      href: "/settings/profile",
    });
  }
  return out.slice(0, 3);
}

function buildActivities(
  savedLetters: SavedLetterRow[],
  jobs: JobRow[],
): ActivityItem[] {
  const out: ActivityItem[] = [];
  for (const l of savedLetters) {
    const target = [l.company_name, l.job_title].filter(Boolean).join(" — ");
    out.push({
      kind: "cover_letter",
      at: l.created_at,
      title: target ? `Saved letter · ${target}` : "Saved a cover letter",
    });
  }
  for (const j of jobs) {
    out.push({
      kind: "job",
      at: j.created_at,
      title: `Added ${j.company} — ${j.position}`,
    });
  }
  out.sort((a, b) => b.at.localeCompare(a.at));
  return out;
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
