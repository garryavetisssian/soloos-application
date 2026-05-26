"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  FileText,
  Kanban,
  LayoutDashboard,
  Link2,
  LogOut,
  Mail,
  Plus,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import { useT } from "@/lib/i18n/hooks";
import { cn } from "@/lib/utils";

// Compact ⌘K command palette — Radix Dialog under the hood for focus
// trap + Escape + scrim. Keeps state in this component; opened from
// AppShell via a global keyboard listener.

type Item = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  /** Where to navigate. Use "signout" for the logout shortcut. */
  action: { kind: "navigate"; href: string } | { kind: "signout" };
  keywords?: string[];
  folio?: string;
};

// Static spec: icons, actions, and translation keys. We don't materialize
// labels here — useT() resolves them at render time so the palette reacts
// to language changes without re-mounting.
type ItemSpec = {
  id: string;
  i18nKey: string;
  icon: React.ReactNode;
  action: Item["action"];
  // English keywords are kept as a search hint. The label itself becomes
  // part of the haystack at render time so users can also search by the
  // visible localized label.
  keywords?: string[];
};

type ItemSpec2 = ItemSpec & { folio?: string };

const ITEM_SPECS: ItemSpec2[] = [
  {
    id: "nav-dashboard",
    i18nKey: "nav.palette.items.dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
    action: { kind: "navigate", href: "/dashboard" },
    keywords: ["home", "stats", "overview", "dashboard"],
    folio: "01",
  },
  {
    id: "cl-new",
    i18nKey: "nav.palette.items.new_cover_letter",
    icon: <Sparkles className="h-4 w-4" />,
    action: { kind: "navigate", href: "/cover-letters/new" },
    keywords: ["generate", "ai", "letter", "compose", "new"],
    folio: "+",
  },
  {
    id: "nav-cover-letters",
    i18nKey: "nav.palette.items.cover_letters",
    icon: <Mail className="h-4 w-4" />,
    action: { kind: "navigate", href: "/cover-letters" },
    keywords: ["library", "saved", "letters"],
    folio: "03",
  },
  {
    id: "nav-links",
    i18nKey: "nav.palette.items.links",
    icon: <Link2 className="h-4 w-4" />,
    action: { kind: "navigate", href: "/portfolio" },
    keywords: ["portfolio", "work links", "github", "figma"],
    folio: "04",
  },
  {
    id: "nav-cvs",
    i18nKey: "nav.palette.items.cvs",
    icon: <FileText className="h-4 w-4" />,
    action: { kind: "navigate", href: "/cvs" },
    keywords: ["resume", "cv builder", "cv"],
    folio: "02",
  },
  {
    id: "nav-jobs",
    i18nKey: "nav.palette.items.jobs",
    icon: <Kanban className="h-4 w-4" />,
    action: { kind: "navigate", href: "/jobs" },
    keywords: ["applications", "kanban", "pipeline"],
    folio: "05",
  },
  {
    id: "nav-profile",
    i18nKey: "nav.palette.items.profile",
    icon: <User className="h-4 w-4" />,
    action: { kind: "navigate", href: "/settings/profile" },
    keywords: ["settings", "preferences", "account", "edit"],
    folio: "P",
  },
  {
    id: "action-new-job",
    i18nKey: "nav.palette.items.add_job",
    icon: <Plus className="h-4 w-4" />,
    action: { kind: "navigate", href: "/jobs" },
    keywords: ["track", "application", "save"],
    folio: "+",
  },
  {
    id: "action-signout",
    i18nKey: "nav.palette.items.signout",
    icon: <LogOut className="h-4 w-4" />,
    action: { kind: "signout" },
    keywords: ["sign out", "logout", "exit"],
    folio: "→",
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const router = useRouter();
  const t = useT();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset query + selection whenever the palette opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  // Resolve each spec's i18n keys into a concrete Item with localized
  // label + hint. The label is included in the searchable haystack so
  // typing the visible (localized) word also matches.
  const items = useMemo<Item[]>(
    () =>
      ITEM_SPECS.map((spec) => {
        const label = t(`${spec.i18nKey}.label`);
        const hintKey = `${spec.i18nKey}.hint`;
        const hintResolved = t(hintKey);
        const hint = hintResolved === hintKey ? undefined : hintResolved;
        return {
          id: spec.id,
          label,
          hint,
          icon: spec.icon,
          action: spec.action,
          keywords: spec.keywords,
          folio: spec.folio,
        };
      }),
    [t],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [
        item.label,
        item.hint ?? "",
        ...(item.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query]);

  // Clamp selection when filter shrinks.
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  function runItem(item: Item) {
    if (item.action.kind === "navigate") {
      onOpenChange(false);
      router.push(item.action.href as never);
    } else if (item.action.kind === "signout") {
      // Submit a hidden form so we get the same CSRF-safe POST to
      // /auth/signout that the account menu uses.
      const form = document.createElement("form");
      form.method = "post";
      form.action = "/auth/signout";
      document.body.appendChild(form);
      form.submit();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[selectedIndex];
      if (item) runItem(item);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm",
            "data-[state=open]:animate-fade-in",
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-[18%] z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2",
            "overflow-hidden rounded-xl border border-border bg-surface shadow-lg",
            "data-[state=open]:animate-dropdown-in",
          )}
        >
          <Dialog.Title className="sr-only">
            {t("nav.palette.title")}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {t("nav.palette.description")}
          </Dialog.Description>
          <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
            <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t("nav.palette.search_placeholder")}
              className={cn(
                "flex-1 bg-transparent text-body text-foreground outline-none",
                "placeholder:text-muted-foreground/70",
              )}
            />
            <kbd
              className={cn(
                "hidden items-center gap-0.5 rounded px-1.5 py-0.5",
                "border border-border bg-surface-elevated",
                "text-[11px] font-medium text-muted-foreground sm:inline-flex",
              )}
            >
              Esc
            </kbd>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-small text-muted-foreground">
                {t("nav.palette.no_matches", { query })}
              </div>
            ) : (
              <ul role="listbox">
                {filtered.map((item, i) => {
                  const selected = i === selectedIndex;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onMouseEnter={() => setSelectedIndex(i)}
                        onClick={() => runItem(item)}
                        className={cn(
                          "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left",
                          "transition-colors duration-150",
                          selected
                            ? "bg-accent-soft text-foreground"
                            : "text-secondary-foreground hover:bg-surface-elevated hover:text-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                            selected
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border bg-surface-elevated text-muted-foreground group-hover:text-foreground",
                          )}
                        >
                          {item.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-small font-medium leading-tight">
                            {item.label}
                          </div>
                          {item.hint && (
                            <div className="truncate text-[12px] text-muted-foreground">
                              {item.hint}
                            </div>
                          )}
                        </div>
                        <ArrowRight
                          className={cn(
                            "h-4 w-4 transition-opacity duration-150",
                            selected
                              ? "opacity-100 text-primary"
                              : "opacity-0 group-hover:opacity-50",
                          )}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border bg-bg-subtle px-4 py-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t(
                filtered.length === 1
                  ? "nav.palette.results_one"
                  : "nav.palette.results_other",
                { count: filtered.length },
              )}
            </span>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <kbd className="rounded border border-border bg-surface px-1 py-0.5">↑</kbd>
              <kbd className="rounded border border-border bg-surface px-1 py-0.5">↓</kbd>
              <span>{t("nav.palette.navigate")}</span>
              <kbd className="rounded border border-border bg-surface px-1 py-0.5">↵</kbd>
              <span>{t("nav.palette.select")}</span>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
