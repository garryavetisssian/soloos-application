"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Route } from "next";
import { cn } from "@/lib/utils";

export type StatAccent = "primary" | "cyan" | "violet" | "emerald";

// Clean Slate stat card — a calm SaaS tile:
//   accent icon chip · big tabular number · muted label · optional trend.
// Interactive (linked) tiles gain a soft hover-lift and reveal an
// ArrowUpRight in the corner. All accents resolve to the emerald
// primary so the dashboard reads as one coherent system.

const ACCENT: Record<StatAccent, { iconBg: string; iconText: string }> = {
  primary: { iconBg: "bg-accent-soft", iconText: "text-primary" },
  cyan: { iconBg: "bg-accent-soft", iconText: "text-primary" },
  violet: { iconBg: "bg-accent-soft", iconText: "text-primary" },
  emerald: { iconBg: "bg-accent-soft", iconText: "text-primary" },
};

interface Props {
  label: string;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
  accent: StatAccent;
  /** Optional trend caption rendered under the number (e.g. "active"). */
  trend?: string;
  /** When set, the tile renders as a Link and gains hover-lift + arrow. */
  href?: Route;
  /** Legacy prop, accepted but no longer rendered. */
  folio?: string;
}

export function AnimatedStatTile({
  label,
  value,
  suffix,
  icon,
  accent,
  trend,
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
      const eased = 1 - Math.pow(1 - progress, 5);
      setDisplay(Math.round(value * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const inner = (
    <>
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            "transition-transform duration-150 ease-out",
            a.iconBg,
            a.iconText,
            href && "group-hover:scale-105",
          )}
        >
          {icon}
        </span>
        {href && (
          <ArrowUpRight
            className={cn(
              "h-4 w-4 text-muted-foreground",
              "opacity-0 -translate-x-1",
              "transition-all duration-150 ease-out",
              "group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-foreground",
            )}
            aria-hidden
          />
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-1 tabular-nums tracking-[-0.02em] text-foreground">
        <span className="text-[32px] font-semibold leading-none">
          {display}
        </span>
        {suffix && (
          <span className="text-[20px] font-medium text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>

      <div className="mt-1.5 text-small font-medium text-muted-foreground">
        {label}
      </div>
      {trend && (
        <div className="mt-0.5 text-label text-success">{trend}</div>
      )}
    </>
  );

  const className = cn(
    "group relative block rounded-xl border border-border bg-surface p-5 shadow-sm",
    "transition-[transform,box-shadow,border-color] duration-150 ease-out",
    href &&
      "cursor-pointer hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
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
