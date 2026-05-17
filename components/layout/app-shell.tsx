"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AlertCircle, X } from "lucide-react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { CommandPalette } from "./command-palette";
import { cn } from "@/lib/utils";

interface Props {
  email: string;
  displayName: string | null;
  completeness: number;
  completenessThreshold: number;
  children: React.ReactNode;
}

// Client-side shell for the authenticated app. Owns:
//   - mobile sidebar open/close state (drawer behaviour under lg)
//   - command palette open/close state (⌘K / Ctrl+K globally)
//   - completeness banner visibility (sessionStorage-dismissed)
//
// The server layout above this fetches user + profile and passes
// down the props. This component never re-queries — it just
// orchestrates client interactivity.
export function AppShell({
  email,
  displayName,
  completeness,
  completenessThreshold,
  children,
}: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Restore the per-session "dismissed" state for the completeness
  // banner so it doesn't pop back up every route change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("soloos.completenessBanner.dismissed") === "1") {
      setBannerDismissed(true);
    }
  }, []);

  // Global ⌘K / Ctrl+K opens the palette from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close mobile sidebar on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("soloos.completenessBanner.dismissed", "1");
    }
  }, []);

  const showBanner = completeness < completenessThreshold && !bannerDismissed;

  return (
    <>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            email={email}
            displayName={displayName}
            onOpenMobileNav={() => setMobileOpen(true)}
            onOpenPalette={() => setPaletteOpen(true)}
          />
          {showBanner && (
            <CompletenessBanner
              completeness={completeness}
              threshold={completenessThreshold}
              onDismiss={dismissBanner}
            />
          )}
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
      />
    </>
  );
}

// Soft completeness banner — only shows when the profile isn't full
// enough to use AI cover letters. Dismissible for the session.
function CompletenessBanner({
  completeness,
  threshold,
  onDismiss,
}: {
  completeness: number;
  threshold: number;
  onDismiss: () => void;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 border-b border-white/[0.06]",
        "bg-gradient-to-r from-primary/12 via-primary/6 to-transparent",
      )}
    >
      <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-6 py-2.5 sm:px-8">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary"
        >
          <AlertCircle className="h-3.5 w-3.5" />
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-small">
          <span className="text-foreground">
            Your profile is {completeness}% complete.
          </span>
          <span className="text-muted-foreground">
            AI cover letters unlock at {threshold}%.
          </span>
          <Link
            href="/settings/profile"
            className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
          >
            Complete profile →
          </Link>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            "text-muted-foreground transition-colors duration-fast",
            "hover:bg-white/[0.06] hover:text-foreground",
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
