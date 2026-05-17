"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { setLocaleAction } from "@/app/(app)/locale-actions";
import { makeT } from "./translate";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from "./types";

const LOCAL_STORAGE_KEY = "soloos.locale";

interface I18nValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export const I18nContext = createContext<I18nValue | null>(null);

interface ProviderProps {
  // Initial locale from the server: profile.preferred_language. The provider
  // hydrates from localStorage on mount so a previously-toggled choice
  // overrides whatever the DB had cached.
  initialLocale: Locale;
  children: ReactNode;
}

function isSupportedLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export function I18nProvider({ initialLocale, children }: ProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (isSupportedLocale(stored) && stored !== locale) {
        setLocaleState(stored);
      }
    } catch {
      // localStorage unavailable (Safari private mode etc.) — ignore.
    }
    // We only want this on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, next);
      } catch {
        // ignore quota / private mode
      }
    }
    // Persist server-side too. We don't await; the UI updates instantly,
    // and the server write follows. Failures are non-fatal — the locale
    // still works for this session via localStorage.
    void setLocaleAction(next).catch(() => {
      // Logged server-side; nothing to surface here.
    });
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: makeT(locale),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export { DEFAULT_LOCALE, SUPPORTED_LOCALES };
