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
  User,
} from "lucide-react";
import Link from "next/link";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { useT } from "@/lib/i18n/hooks";
import { cn } from "@/lib/utils";

interface Props {
  email: string;
  displayName: string | null;
  /** Opens the mobile sidebar drawer. */
  onOpenMobileNav: () => void;
  /** Opens the global command palette. */
  onOpenPalette: () => void;
}

const PAGE_TITLES: Array<{ prefix: string; key: string }> = [
  { prefix: "/cover-letters/new", key: "nav.page_titles.new_cover_letter" },
  { prefix: "/cover-letters", key: "nav.page_titles.cover_letters" },
  { prefix: "/settings/profile", key: "nav.page_titles.career_profile" },
  { prefix: "/settings", key: "nav.page_titles.settings" },
  { prefix: "/portfolio", key: "nav.page_titles.portfolio" },
  { prefix: "/dashboard", key: "nav.page_titles.dashboard" },
  { prefix: "/cvs", key: "nav.page_titles.cvs" },
  { prefix: "/jobs", key: "nav.page_titles.job_tracker" },
];

function pageFor(pathname: string) {
  return PAGE_TITLES.find((entry) => pathname.startsWith(entry.prefix)) ?? null;
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
  const t = useT();
  const page = pageFor(pathname);
  const pageTitle = page ? t(page.key) : "";
  const initials = initialsFrom(displayName, email);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 px-4 sm:px-6",
        "border-b border-border bg-surface/90 backdrop-blur-md",
      )}
    >
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label={t("nav.aria.open_navigation")}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg lg:hidden",
          "text-muted-foreground transition-colors duration-150",
          "hover:bg-surface-elevated hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
      >
        <Menu className="h-4 w-4" />
      </button>

      {pageTitle && (
        <h1 className="min-w-0 truncate text-[16px] font-semibold tracking-[-0.01em] text-foreground">
          {pageTitle}
        </h1>
      )}

      <div className="flex-1" />

      <button
        type="button"
        onClick={onOpenPalette}
        aria-label={t("nav.aria.open_command_palette")}
        className={cn(
          "hidden items-center gap-2 rounded-lg pl-2.5 pr-1.5 h-9 sm:inline-flex",
          "bg-surface border border-border text-small text-muted-foreground",
          "transition-colors duration-150",
          "hover:bg-surface-elevated hover:text-foreground",
          "focus-visible:outline-none focus-visible:border-primary",
        )}
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">{t("nav.search")}</span>
        <kbd
          className={cn(
            "ml-1 hidden items-center gap-0.5 rounded px-1.5 py-0.5 md:inline-flex",
            "border border-border bg-surface-elevated",
            "text-[11px] font-medium text-muted-foreground",
          )}
        >
          ⌘K
        </kbd>
      </button>

      <ThemeToggle />

      <LanguageSwitcher />

      <DropdownMenu.Root onOpenChange={setAccountOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={t("nav.aria.account_menu")}
            className={cn(
              "group inline-flex h-9 items-center gap-2 rounded-lg pl-1 pr-2",
              "bg-surface border border-border",
              "transition-colors duration-150",
              "hover:bg-surface-elevated",
              "data-[state=open]:bg-surface-elevated data-[state=open]:border-primary/40",
              "focus-visible:outline-none",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md",
                "bg-primary text-primary-foreground",
                "text-[11px] font-semibold uppercase tracking-wide",
              )}
            >
              {initials}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
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
              "z-50 min-w-[260px] overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-lg",
              "data-[state=open]:animate-dropdown-in",
            )}
          >
            <div className="flex items-center gap-3 px-2.5 py-3">
              <span
                aria-hidden
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  "bg-primary text-primary-foreground",
                  "text-small font-semibold",
                )}
              >
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-small font-semibold text-foreground">
                  {displayName ?? t("nav.account.your_account")}
                </div>
                <div className="truncate text-[12px] text-muted-foreground">
                  {email}
                </div>
              </div>
            </div>

            <DropdownMenu.Separator className="my-1 h-px bg-border" />

            <MenuLink href="/settings/profile" icon={<User className="h-4 w-4" />}>
              {t("nav.account.profile")}
            </MenuLink>
            <MenuLink
              href="mailto:support@soloos.app"
              icon={<HelpCircle className="h-4 w-4" />}
            >
              {t("nav.account.help_feedback")}
            </MenuLink>

            <DropdownMenu.Separator className="my-1 h-px bg-border" />

            <DropdownMenu.Item asChild>
              <form action="/auth/signout" method="post" className="w-full">
                <button
                  type="submit"
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-small",
                    "text-secondary-foreground outline-none transition-colors duration-150",
                    "hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive",
                  )}
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t("nav.account.log_out")}</span>
                </button>
              </form>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </header>
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
          "relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-small",
          "text-secondary-foreground outline-none transition-colors duration-150",
          "hover:bg-surface-elevated hover:text-foreground",
          "focus:bg-surface-elevated focus:text-foreground",
        )}
      >
        <span className="text-muted-foreground">{icon}</span>
        <span>{children}</span>
      </Link>
    </DropdownMenu.Item>
  );
}
