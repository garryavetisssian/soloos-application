"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

// Light/dark toggle. The initial class is set pre-paint by the
// blocking /theme-init.js script, so this component just reads the
// current state on mount and flips it on click, persisting the choice.
export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    const root = document.documentElement;
    // Suppress transitions for the instant of the swap so text/bg colors
    // flip cleanly instead of fading through mid-transition grays.
    root.classList.add("theme-switching");
    root.classList.toggle("dark", next);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => root.classList.remove("theme-switching"));
    });
    try {
      localStorage.setItem("soloos.theme", next ? "dark" : "light");
    } catch {
      /* storage unavailable — toggle still works for the session */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle color theme"
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg",
        "border border-border bg-surface text-muted-foreground",
        "transition-colors duration-150",
        "hover:bg-surface-elevated hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
    >
      {/* Render a stable icon until mounted to avoid hydration mismatch. */}
      {mounted && isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
