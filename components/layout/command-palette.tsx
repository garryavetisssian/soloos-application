"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  Briefcase,
  FileText,
  Kanban,
  LayoutDashboard,
  LogOut,
  Mail,
  Plus,
  Search,
  Settings,
  Sparkles,
  User,
} from "lucide-react";
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
};

const ITEMS: Item[] = [
  {
    id: "nav-dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
    action: { kind: "navigate", href: "/dashboard" },
    keywords: ["home", "stats", "overview"],
  },
  {
    id: "cl-new",
    label: "New cover letter",
    hint: "Generate from a job link or description",
    icon: <Sparkles className="h-4 w-4" />,
    action: { kind: "navigate", href: "/cover-letters/new" },
    keywords: ["generate", "ai", "letter", "compose"],
  },
  {
    id: "nav-cover-letters",
    label: "Cover letters",
    icon: <Mail className="h-4 w-4" />,
    action: { kind: "navigate", href: "/cover-letters" },
    keywords: ["library", "saved", "letters"],
  },
  {
    id: "nav-portfolio",
    label: "Portfolio",
    hint: "GitHub, Figma, articles, app store",
    icon: <Briefcase className="h-4 w-4" />,
    action: { kind: "navigate", href: "/portfolio" },
    keywords: ["work links", "github", "figma"],
  },
  {
    id: "nav-cvs",
    label: "CVs",
    icon: <FileText className="h-4 w-4" />,
    action: { kind: "navigate", href: "/cvs" },
    keywords: ["resume", "cv builder"],
  },
  {
    id: "nav-jobs",
    label: "Job tracker",
    hint: "Kanban — Saved → Applied → Interview → Offer",
    icon: <Kanban className="h-4 w-4" />,
    action: { kind: "navigate", href: "/jobs" },
    keywords: ["applications", "kanban", "pipeline"],
  },
  {
    id: "nav-profile",
    label: "Career profile",
    icon: <User className="h-4 w-4" />,
    action: { kind: "navigate", href: "/settings/profile" },
    keywords: ["profile", "edit", "settings"],
  },
  {
    id: "nav-settings",
    label: "Settings",
    icon: <Settings className="h-4 w-4" />,
    action: { kind: "navigate", href: "/settings" },
    keywords: ["preferences", "account"],
  },
  {
    id: "action-new-job",
    label: "Add a job",
    hint: "Manually log an application",
    icon: <Plus className="h-4 w-4" />,
    action: { kind: "navigate", href: "/jobs" },
    keywords: ["track", "application", "save"],
  },
  {
    id: "action-signout",
    label: "Log out",
    icon: <LogOut className="h-4 w-4" />,
    action: { kind: "signout" },
    keywords: ["sign out", "logout", "exit"],
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset query + selection whenever the palette opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter((item) => {
      const haystack = [
        item.label,
        item.hint ?? "",
        ...(item.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

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
            "fixed inset-0 z-50 bg-background/70 backdrop-blur-sm",
            "data-[state=open]:animate-fade-in",
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-[18%] z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2",
            "glass-popover overflow-hidden",
            "data-[state=open]:animate-dropdown-in",
          )}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search the app or run an action.
          </Dialog.Description>
          <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search or jump to…"
              className={cn(
                "flex-1 bg-transparent text-body text-foreground outline-none",
                "placeholder:text-muted-foreground",
              )}
            />
            <kbd
              className={cn(
                "hidden items-center gap-0.5 rounded-md px-1.5 py-0.5",
                "border border-white/[0.08] bg-white/[0.04]",
                "font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline-flex",
              )}
            >
              Esc
            </kbd>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-small text-muted-foreground">
                No matches for &ldquo;{query}&rdquo;.
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
                          "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left",
                          "transition-colors duration-fast",
                          selected
                            ? "bg-surface-elevated/85 text-foreground"
                            : "text-secondary-foreground hover:bg-surface-elevated/60 hover:text-foreground",
                        )}
                      >
                        {selected && (
                          <span
                            aria-hidden
                            className="absolute inset-y-1.5 left-0 w-[2px] rounded-r-full bg-primary shadow-[0_0_8px_0_hsl(var(--primary)/0.6)]"
                          />
                        )}
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                            selected
                              ? "bg-primary/15 text-primary"
                              : "bg-white/[0.04] text-muted-foreground group-hover:text-foreground",
                          )}
                        >
                          {item.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-small font-medium">
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
                            "h-3.5 w-3.5 transition-opacity duration-fast",
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
          <div
            className={cn(
              "flex items-center justify-between border-t border-white/[0.06] px-4 py-2",
              "bg-white/[0.02]",
            )}
          >
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "result" : "results"}
            </span>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 font-mono uppercase">
                ↑
              </kbd>
              <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 font-mono uppercase">
                ↓
              </kbd>
              <span>navigate</span>
              <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 font-mono uppercase">
                ↵
              </kbd>
              <span>select</span>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
