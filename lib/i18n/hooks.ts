"use client";

import { useContext } from "react";
import { I18nContext } from "./provider";

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}

// Sugar: just the t() function.
export function useT() {
  return useI18n().t;
}

// Sugar: just the locale + setter.
export function useLocale() {
  const { locale, setLocale } = useI18n();
  return [locale, setLocale] as const;
}
