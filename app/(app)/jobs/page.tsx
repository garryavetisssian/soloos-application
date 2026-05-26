import Link from "next/link";
import { Briefcase, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getServerT } from "@/lib/i18n/server";
import { JOB_STATUSES, type JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// Status → dot color. Subdued, semantic-token only so the preview
// reads cleanly in both themes. The real columns ship later; this is
// a polished empty shell behind a "coming soon" panel.
const STATUS_DOT: Record<JobStatus, string> = {
  saved: "bg-muted-foreground/60",
  applied: "bg-primary/60",
  interview: "bg-primary",
  offer: "bg-success",
  rejected: "bg-destructive/70",
};

export default async function JobsPage() {
  const { t } = await getServerT();
  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-6 py-7 animate-fade-in sm:px-10">
        <div>
          <h1 className="text-h1 font-semibold text-foreground">
            {t("pages.jobs.title")}
          </h1>
          <p className="mt-2 max-w-[60ch] text-body text-muted-foreground">
            {t("pages.jobs.subtitle")}
          </p>
        </div>
        <Button disabled>{t("pages.jobs.add_job")}</Button>
      </header>

      <div className="relative flex-1 overflow-x-auto bg-bg-subtle px-6 py-8 sm:px-10">
        {/* Pipeline columns — empty preview shell. */}
        <div className="grid h-full min-w-[1080px] grid-cols-5 gap-4">
          {JOB_STATUSES.map((status) => (
            <div
              key={status}
              className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
            >
              <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    STATUS_DOT[status],
                  )}
                />
                <span className="text-small font-medium text-foreground">
                  {t(`pages.jobs.status.${status}`)}
                </span>
              </div>
              <div className="flex flex-1 items-stretch p-2.5">
                <div className="w-full rounded-lg border border-dashed border-border/70 bg-bg-subtle" />
              </div>
            </div>
          ))}
        </div>

        {/* Coming-soon panel — sits above the empty columns. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 py-12">
          <div className="pointer-events-auto w-full max-w-[440px] rounded-xl border border-border bg-surface p-8 text-center shadow-lg">
            <div className="flex justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent-soft text-primary">
                <Briefcase className="h-6 w-6" />
              </span>
            </div>
            <h2 className="mt-5 text-h2 font-semibold text-foreground">
              {t("pages.jobs.coming_title")}
            </h2>
            <p className="mx-auto mt-2 max-w-[40ch] text-small text-muted-foreground">
              {t("pages.jobs.coming_body")}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button asChild>
                <Link href="/cover-letters/new">
                  <Mail className="h-4 w-4" />
                  {t("pages.jobs.cta_write_letter")}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
