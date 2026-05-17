import Link from "next/link";
import { Briefcase, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JOB_STATUSES, JOB_STATUS_LABELS, type JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// Status → accent recipe for the Kanban column headers. Carries the
// same accent palette the rest of the app uses (cyan / primary / emerald)
// so the column header reads at a glance which stage it is.
const STATUS_ACCENT: Record<
  JobStatus,
  { dot: string; chip: string }
> = {
  saved: { dot: "bg-muted-foreground", chip: "text-muted-foreground" },
  applied: { dot: "bg-cyan-400 shadow-[0_0_6px_0_hsl(190_91%_62%/0.7)]", chip: "text-cyan-400" },
  interview: { dot: "bg-primary shadow-[0_0_6px_0_hsl(var(--primary)/0.7)]", chip: "text-primary" },
  offer: { dot: "bg-emerald-400 shadow-[0_0_6px_0_hsl(158_64%_52%/0.7)]", chip: "text-emerald-400" },
  rejected: { dot: "bg-destructive/80", chip: "text-destructive/90" },
};

// Job tracker — Kanban shell. The action handlers aren't wired yet so
// the page renders an empty pipeline with a coming-soon overlay state.
// The five columns still render so the user understands the eventual
// shape; the overlay sells the next step.
export default function JobsPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-5 sm:px-8">
        <div>
          <h1 className="text-h1 font-semibold tracking-tight">Job tracker</h1>
          <p className="pt-1 text-small text-muted-foreground">
            Move applications through your pipeline.
          </p>
        </div>
        <Button disabled>Add job</Button>
      </header>

      <div className="relative flex-1 overflow-x-auto px-6 py-6 sm:px-8">
        {/* Pipeline columns — preview-only for now. */}
        <div className="grid h-full min-w-[1080px] grid-cols-5 gap-3">
          {JOB_STATUSES.map((status) => {
            const a = STATUS_ACCENT[status];
            return (
              <div
                key={status}
                className={cn(
                  "flex flex-col rounded-lg",
                  "glass-card",
                )}
              >
                <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", a.dot)} />
                    <span className={cn("text-small font-medium", a.chip)}>
                      {JOB_STATUS_LABELS[status]}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    0
                  </span>
                </div>
                <div className="flex-1 px-2 py-3" />
              </div>
            );
          })}
        </div>

        {/* Coming-soon overlay — sits above the empty columns. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 py-12">
          <div
            className={cn(
              "pointer-events-auto relative flex flex-col items-center justify-center overflow-hidden rounded-2xl px-8 py-12 text-center",
              "glass-card max-w-[440px]",
            )}
          >
            <div
              aria-hidden
              className={cn(
                "absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full opacity-60 blur-3xl",
                "bg-gradient-to-br from-primary/40 via-[hsl(var(--accent-violet))]/30 to-[hsl(var(--accent-cyan))]/20",
              )}
            />
            <span
              className={cn(
                "relative flex h-14 w-14 items-center justify-center rounded-2xl",
                "bg-gradient-to-br from-primary/15 to-[hsl(var(--accent-violet))]/15",
                "ring-1 ring-primary/30",
                "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.1)]",
              )}
            >
              <Briefcase className="h-6 w-6 text-primary" />
            </span>
            <h2 className="relative mt-5 text-h3 font-semibold tracking-tight">
              The pipeline is almost here
            </h2>
            <p className="relative mt-1.5 max-w-[36ch] text-small leading-relaxed text-muted-foreground">
              Add jobs from LinkedIn, Indeed, Upwork — or anywhere — and move
              them across Saved → Applied → Interview → Offer.
            </p>
            <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button asChild size="default">
                <Link href="/cover-letters/new">
                  <Mail className="h-4 w-4" />
                  Write a cover letter
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
