"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChevronDown,
  HelpCircle,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
} from "lucide-react";
import Link from "next/link";
import { LanguageSwitcher } from "./language-switcher";
import { cn } from "@/lib/utils";

interface Props {
  email: string;
  displayName: string | null;
  /** Opens the mobile sidebar drawer. */
  onOpenMobileNav: () => void;
  /** Opens the global command palette. */
  onOpenPalette: () => void;
}

// Mapping pathname-prefixes → display title for the current page.
// Longest-prefix match wins (handles /settings/profile vs /settings).
const PAGE_TITLES: Array<{ prefix: string; label: string }> = [
  { prefix: "/cover-letters/new", label: "New cover letter" },
  { prefix: "/cover-letters", label: "Cover letters" },
  { prefix: "/settings/profile", label: "Career profile" },
  { prefix: "/settings", label: "Settings" },
  { prefix: "/portfolio", label: "Portfolio" },
  { prefix: "/dashboard", label: "Dashboard" },
  { prefix: "/cvs", label: "CVs" },
  { prefix: "/jobs", label: "Job tracker" },
];

function titleFor(pathname: string): string {
  const best = PAGE_TITLES.find((entry) => pathname.startsWith(entry.prefix));
  return best?.label ?? "";
}

function initialsFrom(displayName: string | null, email: string): string {
  const source =
    displayName?.trim() && displayName.trim().length > 0
      ? displayName.trim()
      : email.split("@")[0] ?? email;
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function TopBar({
  email,
  displayName,
  onOpenMobileNav,
  onOpenPalette,
}: Props) {
  const pathname = usePathname();
  const pageTitle = titleFor(pathname);
  const initials = initialsFrom(displayName, email);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div
      className={cn(
        "relative flex h-14 shrink-0 items-center gap-3 px-4 sm:px-6",
        "glass-chrome",
        "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px",
        "after:bg-gradient-to-r after:from-transparent after:via-white/[0.08] after:to-transparent",
      )}
    >
      {/* Mobile hamburger — opens the sidebar drawer. Hidden on lg+. */}
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md lg:hidden",
          "text-muted-foreground transition-colors duration-fast",
          "hover:bg-surface-elevated/70 hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Current page title — keeps people oriented across deep routes. */}
      {pageTitle && (
        <h1 className="truncate text-small font-medium text-foreground">
          {pageTitle}
        </h1>
      )}

      <div className="flex-1" />

      {/* ⌘K palette trigger — visible on sm+ so mobile keeps the chrome clean. */}
      <button
        type="button"
        onClick={onOpenPalette}
        aria-label="Open command palette"
        className={cn(
          "hidden items-center gap-2 rounded-md pl-2.5 pr-1.5 h-8 sm:inline-flex",
          "bg-surface/55 backdrop-blur-xl border border-white/[0.08]",
          "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.04)]",
          "text-small text-muted-foreground",
          "transition-[border-color,background-color,box-shadow,color] duration-fast ease-out-quint",
          "hover:bg-surface-elevated/70 hover:border-white/[0.14] hover:text-foreground",
          "focus-visible:outline-none focus-visible:border-primary/45",
        )}
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Search</span>
        <kbd
          className={cn(
            "ml-1 hidden items-center gap-0.5 rounded px-1 py-0.5 md:inline-flex",
            "border border-white/[0.08] bg-white/[0.04]",
            "font-mono text-[10px] uppercase tracking-wider text-muted-foreground",
          )}
        >
          ⌘K
        </kbd>
      </button>

      <LanguageSwitcher />

      {/* Account menu — avatar + dropdown with profile / settings / logout. */}
      <DropdownMenu.Root onOpenChange={setAccountOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Account menu"
            className={cn(
              "group inline-flex h-9 items-center gap-2 rounded-md pl-1 pr-2.5",
              "bg-surface/55 backdrop-blur-xl border border-white/[0.08]",
              "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.04)]",
              "transition-[border-color,background-color,box-shadow] duration-fast ease-out-quint",
              "hover:bg-surface-elevated/70 hover:border-white/[0.14]",
              "data-[state=open]:bg-surface-elevated/85 data-[state=open]:border-primary/45 data-[state=open]:shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.06),0_0_0_3px_hsl(var(--primary)/0.18)]",
              "focus-visible:outline-none",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full",
                "bg-gradient-to-br from-primary to-[hsl(var(--accent-violet))]",
                "text-[11px] font-semibold text-primary-foreground",
                "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.25),0_4px_10px_-4px_hsl(var(--primary)/0.5)]",
              )}
            >
              {initials}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-fast",
                accountOpen && "rotate-180",
              )}
            />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className={cn(
              "z-50 min-w-[240px] overflow-hidden p-1.5",
              "glass-popover",
              "data-[state=open]:animate-dropdown-in",
            )}
          >
            <div className="flex items-center gap-3 px-2.5 py-2.5">
              <span
                aria-hidden
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full",
                  "bg-gradient-to-br from-primary to-[hsl(var(--accent-violet))]",
                  "text-small font-semibold text-primary-foreground",
                  "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.25)]",
                )}
              >
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-small font-medium text-foreground">
                  {displayName ?? "Your account"}
                </div>
                <div className="truncate text-[12px] text-muted-foreground">
                  {email}
                </div>
              </div>
            </div>

            <DropdownMenu.Separator className="my-1 h-px bg-white/[0.06]" />

            <MenuLink href="/settings/profile" icon={<User className="h-4 w-4" />}>
              Profile
            </MenuLink>
            <MenuLink href="/settings" icon={<Settings className="h-4 w-4" />}>
              Settings
            </MenuLink>
            <MenuLink
              href="mailto:support@soloos.app"
              icon={<HelpCircle className="h-4 w-4" />}
            >
              Help &amp; feedback
            </MenuLink>

            <DropdownMenu.Separator className="my-1 h-px bg-white/[0.06]" />

            <DropdownMenu.Item asChild>
              <form action="/auth/signout" method="post" className="w-full">
                <button
                  type="submit"
                  className={cn(
                    "group/log flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-small",
                    "text-secondary-foreground outline-none transition-colors duration-fast",
                    "hover:bg-destructive/12 hover:text-destructive focus:bg-destructive/12 focus:text-destructive",
                  )}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log out</span>
                </button>
              </form>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function MenuLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        href={href as never}
        className={cn(
          "relative flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-small",
          "text-secondary-foreground outline-none transition-colors duration-fast",
          "hover:bg-surface-elevated/80 hover:text-foreground",
          "focus:bg-surface-elevated/80 focus:text-foreground",
          "focus:before:absolute focus:before:inset-y-1.5 focus:before:left-0 focus:before:w-[2px] focus:before:rounded-r-full focus:before:bg-primary",
        )}
      >
        <span className="text-muted-foreground">{icon}</span>
        <span>{children}</span>
      </Link>
    </DropdownMenu.Item>
  );
}
