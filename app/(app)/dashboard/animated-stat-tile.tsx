"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Route } from "next";
import { cn } from "@/lib/utils";

export type StatAccent = "primary" | "cyan" | "violet" | "emerald";

const ACCENT: Record<
  StatAccent,
  { gradient: string; text: string; iconBg: string; ring: string; hoverRing: string }
> = {
  primary: {
    gradient: "from-primary/18 via-transparent to-violet-500/12",
    text: "text-primary",
    iconBg: "bg-primary/15",
    ring: "ring-primary/20",
    hoverRing: "group-hover:ring-primary/45",
  },
  cyan: {
    gradient: "from-cyan-500/18 via-transparent to-cyan-500/6",
    text: "text-cyan-400",
    iconBg: "bg-cyan-500/15",
    ring: "ring-cyan-500/20",
    hoverRing: "group-hover:ring-cyan-500/45",
  },
  violet: {
    gradient: "from-violet-500/18 via-transparent to-fuchsia-500/12",
    text: "text-violet-400",
    iconBg: "bg-violet-500/15",
    ring: "ring-violet-500/20",
    hoverRing: "group-hover:ring-violet-500/45",
  },
  emerald: {
    gradient: "from-emerald-500/18 via-transparent to-cyan-500/6",
    text: "text-emerald-400",
    iconBg: "bg-emerald-500/15",
    ring: "ring-emerald-500/20",
    hoverRing: "group-hover:ring-emerald-500/45",
  },
};

interface Props {
  label: string;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
  accent: StatAccent;
  /** When set, the tile renders as a Link and gains a hover lift + arrow. */
  href?: Route;
}

// Eased count-up driven by requestAnimationFrame, animated entrance,
// and (optionally) clickable. Resets if `value` changes.
export function AnimatedStatTile({
  label,
  value,
  suffix,
  icon,
  accent,
  href,
}: Props) {
  const a = ACCENT[accent];
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }
    let raf: number;
    const start = performance.now();
    const duration = 1100;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out quint — punchier than cubic, matches our motion token.
      const eased = 1 - Math.pow(1 - progress, 5);
      setDisplay(Math.round(value * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const inner = (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-55 transition-opacity duration-medium",
          a.gradient,
          href && "group-hover:opacity-95",
        )}
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-small text-muted-foreground">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-transform duration-fast ease-out-quint",
                a.iconBg,
                a.text,
                href && "group-hover:scale-110 group-hover:rotate-[-4deg]",
              )}
            >
              {icon}
            </span>
            {label}
          </div>
          {href && (
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md",
                "text-muted-foreground opacity-0 -translate-x-1",
                "transition-all duration-fast ease-out-quint",
                "group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-foreground",
              )}
              aria-hidden
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <div className="mt-4 text-h1 font-semibold tabular-nums tracking-tight text-foreground">
          {display}
          {suffix}
        </div>
      </div>
    </>
  );

  const className = cn(
    "group relative block overflow-hidden rounded-2xl border border-white/[0.06] bg-surface/60 p-4",
    "backdrop-blur-xl ring-1",
    a.ring,
    a.hoverRing,
    "transition-[transform,box-shadow,border-color,ring-color] duration-medium ease-out-quint",
    href &&
      "hover:-translate-y-1 hover:border-white/[0.14] hover:shadow-glass-hover cursor-pointer",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
