"use client";

// Global toast system.
//
// Usage:
//   const { toast } = useToast();
//   toast.success("Link added");
//   toast.error("Couldn't reach the server", "Try again in a moment");
//   toast.info("Cover letter saved");
//
// Mounted once at (app)/layout.tsx. Toasts slide in from the top-
// right, stack vertically, auto-dismiss after 4.5s with a slide-out.
// Color-coded per kind. No more bottom-centered mystery pills.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AlertCircle, Check, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";

interface ToastShape {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  exiting?: boolean;
}

interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

interface ToastContextValue {
  toast: ToastApi;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Visible time before exit animation kicks in.
const TOAST_VISIBLE_MS = 4500;
// Time we keep the toast in the DOM after starting the exit transition
// (kept in sync with the CSS transition duration below).
const TOAST_EXIT_MS = 220;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastShape[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((curr) =>
      curr.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    );
    window.setTimeout(() => {
      setToasts((curr) => curr.filter((t) => t.id !== id));
    }, TOAST_EXIT_MS);
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((curr) => [...curr, { id, kind, title, description }]);
      window.setTimeout(() => dismiss(id), TOAST_VISIBLE_MS);
    },
    [dismiss],
  );

  const value: ToastContextValue = {
    toast: {
      success: (t, d) => push("success", t, d),
      error: (t, d) => push("error", t, d),
      info: (t, d) => push("info", t, d),
    },
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

// =============================================================
// Viewport + Toast item
// =============================================================

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastShape[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-end gap-2 px-4 py-4 sm:px-6 sm:py-6"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

const TONE: Record<
  ToastKind,
  {
    container: string;
    icon: React.ReactNode;
    iconBg: string;
  }
> = {
  success: {
    container:
      "border-success/30 bg-surface ring-1 ring-success/15 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)]",
    icon: <Check className="h-3.5 w-3.5" />,
    iconBg: "bg-success/15 text-success",
  },
  error: {
    container:
      "border-destructive/40 bg-surface ring-1 ring-destructive/20 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)]",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    iconBg: "bg-destructive/15 text-destructive",
  },
  info: {
    container:
      "border-primary/30 bg-surface ring-1 ring-primary/15 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)]",
    icon: <Info className="h-3.5 w-3.5" />,
    iconBg: "bg-primary/15 text-primary",
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastShape;
  onDismiss: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  // Trigger the enter animation on the next frame so the initial
  // translate state actually renders before we transition to the
  // resting state.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const tone = TONE[toast.kind];
  const stateClasses = toast.exiting
    ? "translate-x-[calc(100%+1.5rem)] opacity-0"
    : mounted
      ? "translate-x-0 opacity-100"
      : "translate-x-[calc(100%+1.5rem)] opacity-0";

  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      aria-live={toast.kind === "error" ? "assertive" : "polite"}
      className={cn(
        "pointer-events-auto flex w-full max-w-[380px] items-start gap-3 rounded-xl border px-4 py-3 transition-all duration-200 ease-out",
        tone.container,
        stateClasses,
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          tone.iconBg,
        )}
      >
        {tone.icon}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="text-small font-medium text-foreground">
          {toast.title}
        </div>
        {toast.description && (
          <p className="pt-0.5 text-small text-muted-foreground">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
