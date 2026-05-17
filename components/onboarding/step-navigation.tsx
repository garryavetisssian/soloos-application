"use client";

import { Check, Circle } from "lucide-react";
import { STEPS } from "@/lib/onboarding-content";
import type { OnboardingStep } from "@/lib/profile-form";
import { cn } from "@/lib/utils";

export type StepStatus = "complete" | "current" | "incomplete" | "upcoming";

interface Props {
  // null when the user isn't currently in a manual step
  // (e.g. decide / import upload / import review screens).
  current: OnboardingStep | null;
  statuses: Record<OnboardingStep, StepStatus>;
  onSelect: (step: OnboardingStep) => void;
}

export function StepNavigation({ current, statuses, onSelect }: Props) {
  return (
    <nav aria-label="Onboarding steps" className="space-y-1">
      <div className="px-3 pb-3 text-small uppercase tracking-wide text-muted-foreground">
        Profile setup
      </div>
      <ol className="space-y-0.5">
        {STEPS.map((step) => {
          const status = statuses[step.id];
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={status === "current" ? "step" : undefined}
                className={cn(
                  "group flex w-full gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                  status === "current"
                    ? "bg-surface-elevated"
                    : "hover:bg-surface-elevated/60",
                )}
              >
                <StatusIcon status={status} number={step.id} />
                <div className="min-w-0">
                  <div
                    className={cn(
                      "text-small font-medium",
                      status === "current"
                        ? "text-foreground"
                        : status === "incomplete"
                          ? "text-foreground"
                          : "text-secondary-foreground",
                    )}
                  >
                    {step.navTitle}
                  </div>
                  <div className="truncate text-small text-muted-foreground">
                    {step.navDescription}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
      {current != null && (
        <div className="px-3 pt-4 text-small text-muted-foreground">
          Step {current} of {STEPS.length}
        </div>
      )}
    </nav>
  );
}

function StatusIcon({
  status,
  number,
}: {
  status: StepStatus;
  number: number;
}) {
  if (status === "complete") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-3 w-3" />
      </span>
    );
  }
  if (status === "current") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary text-small font-medium text-foreground">
        {number}
      </span>
    );
  }
  if (status === "incomplete") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-warning/60">
        <Circle className="h-1.5 w-1.5 fill-warning text-warning" />
      </span>
    );
  }
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-small text-muted-foreground">
      {number}
    </span>
  );
}
