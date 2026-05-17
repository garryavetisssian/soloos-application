"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  LayoutDashboard,
  FileText,
  Mail,
  Kanban,
  Settings,
  User,
  X,
} from "lucide-react";
import { useT } from "@/lib/i18n/hooks";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", labelKey: "common.nav.dashboard", icon: LayoutDashboard },
  { href: "/cvs", labelKey: "common.nav.cvs", icon: FileText },
  { href: "/portfolio", labelKey: "common.nav.portfolio", icon: Briefcase },
  { href: "/cover-letters", labelKey: "common.nav.cover_letters", icon: Mail },
  { href: "/jobs", labelKey: "common.nav.job_tracker", icon: Kanban },
  { href: "/settings/profile", labelKey: "common.nav.profile", icon: User },
  { href: "/settings", labelKey: "common.nav.settings", icon: Settings },
] as const;

interface Props {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: Props) {
  const pathname = usePathname();
  const t = useT();

  return (
    <>
      {/* Mobile scrim — fades + locks scroll when the drawer's open. */}
      <button
        type="button"
        aria-hidden={!mobileOpen}
        tabIndex={mobileOpen ? 0 : -1}
        onClick={onCloseMobile}
        aria-label="Close navigation"
        className={cn(
          "fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden",
          "transition-opacity duration-medium ease-out-quint",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-[248px] flex-col",
          "glass-chrome",
          // Right-edge hairline.
          "before:pointer-events-none before:absolute before:inset-y-0 before:right-0 before:w-px",
          "before:bg-gradient-to-b before:from-white/[0.04] before:via-white/[0.10] before:to-white/[0.03]",
          // Mobile drawer behaviour: slide in from the left.
          "transition-transform duration-medium ease-out-quint",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: static, always visible.
          "lg:static lg:translate-x-0",
        )}
      >
        {/* Mobile close button — hidden on lg+. */}
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className={cn(
            "absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md",
            "text-muted-foreground transition-colors duration-fast",
            "hover:bg-surface-elevated/70 hover:text-foreground",
            "lg:hidden",
          )}
        >
          <X className="h-4 w-4" />
        </button>

        <Link
          href="/dashboard"
          className="group flex items-center gap-2 px-5 pt-6 pb-5"
        >
          <span
            aria-hidden
            className={cn(
              "h-7 w-7 shrink-0 rounded-md",
              "bg-gradient-to-br from-primary to-[hsl(var(--accent-violet))]",
              "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.25),0_4px_14px_-4px_hsl(var(--primary)/0.55)]",
              "transition-transform duration-fast ease-out-quint",
              "group-hover:scale-[1.05]",
            )}
          />
          <span className="text-h3 font-semibold tracking-tight text-foreground">
            SoloOS
          </span>
        </Link>

        <nav className="flex-1 px-3 py-2">
          <ul className="space-y-0.5">
            {NAV.map(({ href, labelKey, icon: Icon }) => {
              const matches =
                pathname === href || pathname.startsWith(href + "/");
              const moreSpecificMatch =
                matches &&
                NAV.some(
                  (other) =>
                    other.href !== href &&
                    other.href.length > href.length &&
                    (pathname === other.href ||
                      pathname.startsWith(other.href + "/")),
                );
              const active = matches && !moreSpecificMatch;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-small",
                      "transition-[background-color,color,transform] duration-fast ease-out-quint",
                      !active && [
                        "text-muted-foreground",
                        "hover:bg-surface-elevated/60 hover:text-foreground hover:backdrop-blur-md",
                      ],
                      active && [
                        "text-foreground",
                        "bg-gradient-to-r from-primary/16 via-primary/6 to-transparent",
                        "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.05)]",
                      ],
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-y-1.5 left-0 w-[2px] rounded-r-full",
                          "bg-gradient-to-b from-primary via-primary to-primary/40",
                          "shadow-[0_0_10px_0_hsl(var(--primary)/0.6)]",
                        )}
                      />
                    )}
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors duration-fast",
                        active
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
                    <span className="truncate">{t(labelKey)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-5 py-4">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5",
              "bg-white/[0.04] border border-white/[0.06]",
              "text-[11px] font-medium text-muted-foreground",
            )}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px_0_hsl(var(--success)/0.7)]"
            />
            v0.1 · Beta
          </span>
        </div>
      </aside>
    </>
  );
}
