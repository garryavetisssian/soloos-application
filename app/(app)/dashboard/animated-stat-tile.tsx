"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type StatAccent = "primary" | "cyan" | "violet" | "emerald";

const ACCENT: Record<
  StatAccent,
  { gradient: string; text: string; iconBg: string; ring: string }
> = {
  primary: {
    gradient: "from-primary/15 via-transparent to-violet-500/10",
    text: "text-primary",
    iconBg: "bg-primary/15",
    ring: "ring-primary/20",
  },
  cyan: {
    gradient: "from-cyan-500/15 via-transparent to-cyan-500/5",
    text: "text-cyan-400",
    iconBg: "bg-cyan-500/15",
    ring: "ring-cyan-500/20",
  },
  violet: {
    gradient: "from-violet-500/15 via-transparent to-fuchsia-500/10",
    text: "text-violet-400",
    iconBg: "bg-violet-500/15",
    ring: "ring-violet-500/20",
  },
  emerald: {
    gradient: "from-emerald-500/15 via-transparent to-cyan-500/5",
    text: "text-emerald-400",
    iconBg: "bg-emerald-500/15",
    ring: "ring-emerald-500/20",
  },
};

interface Props {
  label: string;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
  accent: StatAccent;
}

// Eased count-up driven by requestAnimationFrame. No external deps.
// Resets if `value` changes (e.g. after revalidation).
export function AnimatedStatTile({ label, value, suffix, icon, accent }: Props) {
  const a = ACCENT[accent];
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }
    let raf: number;
    const start = performance.now();
    const duration = 800;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-surface p-4 transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-primary/40",
        "ring-1",
        a.ring,
      )}
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity duration-300 group-hover:opacity-80",
          a.gradient,
        )}
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-small text-muted-foreground">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md",
              a.iconBg,
              a.text,
            )}
          >
            {icon}
          </span>
          {label}
        </div>
        <div className="mt-3 text-h1 tabular-nums tracking-tight text-foreground">
          {display}
          {suffix}
        </div>
      </div>
    </div>
  );
}
