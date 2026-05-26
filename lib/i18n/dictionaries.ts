// All locale dictionaries are imported statically (the files are small) and
// merged into a single record indexed by locale. Server and client both use
// the same data source via translate.ts.

import enCommon from "@/locales/en/common.json";
import enCoverLetter from "@/locales/en/cover-letter.json";
import enDashboard from "@/locales/en/dashboard.json";
import enNav from "@/locales/en/nav.json";
import enPages from "@/locales/en/pages.json";
import enPortfolio from "@/locales/en/portfolio.json";
import ruCommon from "@/locales/ru/common.json";
import ruCoverLetter from "@/locales/ru/cover-letter.json";
import ruDashboard from "@/locales/ru/dashboard.json";
import ruNav from "@/locales/ru/nav.json";
import ruPages from "@/locales/ru/pages.json";
import ruPortfolio from "@/locales/ru/portfolio.json";
import hyCommon from "@/locales/hy/common.json";
import hyCoverLetter from "@/locales/hy/cover-letter.json";
import hyDashboard from "@/locales/hy/dashboard.json";
import hyNav from "@/locales/hy/nav.json";
import hyPages from "@/locales/hy/pages.json";
import hyPortfolio from "@/locales/hy/portfolio.json";

import type { Locale } from "./types";

// Each locale's dictionary is a nested record. We merge the per-namespace
// JSON files under top-level keys matching their filename — i.e. "common.*"
// and "cover_letter.*" (filename "cover-letter" mapped to "cover_letter" so
// the dotted-path syntax in t() doesn't trip on hyphens).
export const dictionaries = {
  en: {
    common: enCommon,
    cover_letter: enCoverLetter,
    dashboard: enDashboard,
    nav: enNav,
    pages: enPages,
    portfolio: enPortfolio,
  },
  ru: {
    common: ruCommon,
    cover_letter: ruCoverLetter,
    dashboard: ruDashboard,
    nav: ruNav,
    pages: ruPages,
    portfolio: ruPortfolio,
  },
  hy: {
    common: hyCommon,
    cover_letter: hyCoverLetter,
    dashboard: hyDashboard,
    nav: hyNav,
    pages: hyPages,
    portfolio: hyPortfolio,
  },
} as const;

export type Dictionary = (typeof dictionaries)[Locale];
