"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Mail,
  Kanban,
  Link2,
  X,
} from "lucide-react";
import { useT } from "@/lib/i18n/hooks";
import { cn } from "@/lib/utils";

// Clean Slate sidebar — wordmark + icon/label nav. The active row is an
// emerald soft-bg pill with an emerald icon/label.

const NAV = [
  { href: "/dashboard", labelKey: "common.nav.dashboard", icon: LayoutDashboard },
  { href: "/cvs", labelKey: "common.nav.cvs", icon: FileText },
  { href: "/cover-letters", labelKey: "common.nav.cover_letters", icon: Mail },
  { href: "/portfolio", labelKey: "common.nav.links", icon: Link2 },
  { href: "/jobs", labelKey: "common.nav.job_tracker", icon: Kanban },
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
      <button
        type="button"
        aria-hidden={!mobileOpen}
        tabIndex={mobileOpen ? 0 : -1}
        onClick={onCloseMobile}
        aria-label={t("nav.aria.close_navigation")}
        className={cn(
          "fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm lg:hidden",
          "transition-opacity duration-200 ease-out",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-[256px] flex-col",
          "bg-surface border-r border-border",
          "transition-transform duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:translate-x-0",
        )}
      >
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label={t("nav.aria.close_navigation")}
          className={cn(
            "absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg",
            "text-muted-foreground transition-colors duration-150",
            "hover:bg-surface-elevated hover:text-foreground",
            "lg:hidden",
          )}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Wordmark */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 px-5 pt-6 pb-5"
        >
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-[15px] font-bold"
          >
            S
          </span>
          <span className="text-[19px] font-semibold tracking-[-0.02em] text-foreground">
            SoloOS
          </span>
        </Link>

        <nav className="flex-1 px-3 py-2">
          <ul className="space-y-1">
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
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-small font-medium",
                      "transition-colors duration-150",
                      active
                        ? "bg-accent-soft text-primary"
                        : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-colors duration-150",
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

        {/* Footer imprint */}
        <div className="px-5 py-4 border-t border-border">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-success"
            />
            <span className="text-label uppercase tracking-wide text-muted-foreground">
              v0.1 · Beta
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
