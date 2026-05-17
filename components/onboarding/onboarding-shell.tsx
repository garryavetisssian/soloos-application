import { ArrowRight } from "lucide-react";
import { skipOnboardingAction } from "@/app/onboarding/actions";
import { cn } from "@/lib/utils";

interface Props {
  nav: React.ReactNode;
  assistant: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

// Three-column desktop workspace:
//   ┌──────────────────────────────────────────────────────────────┐
//   │ SoloOS                                       [Skip for now → ]│
//   ├───────────────┬──────────────────────────┬───────────────────┤
//   │ Progress nav  │ Main step content         │ Profile assistant │
//   └───────────────┴──────────────────────────┴───────────────────┘
//
// The header now exposes a "Skip for now" form-action that calls the
// skipOnboardingAction server action — creates a minimal profile row
// and redirects to /dashboard, letting users explore the product
// before completing onboarding.
export function OnboardingShell({ nav, assistant, children, className }: Props) {
  return (
    <div className={cn("flex h-screen flex-col bg-background", className)}>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="h-6 w-6 rounded-md bg-gradient-to-br from-primary to-[hsl(var(--accent-violet))] shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.25),0_4px_12px_-4px_hsl(var(--primary)/0.5)]"
          />
          <span className="text-h3 font-semibold tracking-tight">SoloOS</span>
          <span className="text-small text-muted-foreground">Onboarding</span>
        </div>
        <form action={skipOnboardingAction}>
          <button
            type="submit"
            className={cn(
              "group inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5",
              "text-small text-muted-foreground",
              "transition-colors duration-fast hover:text-foreground hover:bg-surface-elevated/70",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
          >
            Skip for now
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-fast group-hover:translate-x-0.5" />
          </button>
        </form>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
        <aside className="hidden overflow-y-auto border-r border-border bg-surface px-4 py-6 lg:block">
          {nav}
        </aside>
        <main className="overflow-y-auto px-6 py-10 sm:px-12">{children}</main>
        <aside className="hidden overflow-y-auto border-l border-border bg-surface px-5 py-6 lg:block">
          {assistant}
        </aside>
      </div>
    </div>
  );
}
