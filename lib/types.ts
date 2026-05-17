export type Language = "en" | "ru" | "hy";

export type LanguageLevel =
  | "Native"
  | "Fluent"
  | "Advanced"
  | "Intermediate"
  | "Basic"
  | "Unknown";

// Levels the user can pick in the UI. "Unknown" is reserved for legacy rows
// imported from the old plain-text languages format — surfaced read-only
// until the user upgrades it.
export const SELECTABLE_LANGUAGE_LEVELS: LanguageLevel[] = [
  "Native",
  "Fluent",
  "Advanced",
  "Intermediate",
  "Basic",
];
export const LANGUAGE_LEVELS: LanguageLevel[] = [
  ...SELECTABLE_LANGUAGE_LEVELS,
  "Unknown",
];

export interface LanguageEntry {
  name: string;
  level: LanguageLevel;
}

export type Currency =
  | "USD"
  | "EUR"
  | "GBP"
  | "AMD"
  | "RUB"
  | "AED"
  | "CAD"
  | "AUD"
  | "PLN"
  | "TRY";

export const CURRENCIES: Currency[] = [
  "USD",
  "EUR",
  "GBP",
  "AMD",
  "RUB",
  "AED",
  "CAD",
  "AUD",
  "PLN",
  "TRY",
];

// Prefix used for the live preview ("$2,000 – $3,000 per month"). For
// currencies without a single short Latin-script symbol we prefix with the
// ISO code + a space so the preview reads cleanly in any language.
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  AMD: "֏",
  RUB: "₽",
  AED: "AED ",
  CAD: "CA$",
  AUD: "A$",
  PLN: "PLN ",
  TRY: "₺",
};

export type SalaryPeriod = "monthly" | "yearly";
export const SALARY_PERIODS: SalaryPeriod[] = ["monthly", "yearly"];

// Form-state shape for the salary inputs. Min/max are strings here because
// they're driven by <input> elements; they're parsed to integers when
// converting to the structured columns persisted in user_profiles.
export interface SalaryParts {
  currency: Currency;
  period: SalaryPeriod;
  min: string;
  max: string;
}

export type JobStatus =
  | "saved"
  | "applied"
  | "interview"
  | "offer"
  | "rejected";

export interface User {
  id: string;
  email: string;
  name: string | null;
  language: Language;
  created_at: string;
}

export interface Cv {
  id: string;
  user_id: string;
  title: string;
  summary: string | null;
  language: Language;
  created_at: string;
}

// `resume_id` matches the DB column on `experiences` from the initial schema.
// The DB column is intentionally not migrated as part of the resume → CV
// rename; only the user-facing surface (UI labels, routes, type names) was
// renamed. If/when the CV builder is implemented and the table renamed, this
// field name should be updated accordingly.
export interface Experience {
  id: string;
  resume_id: string;
  company: string;
  role: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface Job {
  id: string;
  user_id: string;
  company: string;
  position: string;
  link: string | null;
  status: JobStatus;
  notes: string | null;
  created_at: string;
}

export interface CoverLetter {
  id: string;
  user_id: string;
  job_description: string;
  generated_text: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  current_role: string | null;
  location: string | null;
  email: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  preferred_language: Language;
  years_of_experience: string | null;
  professional_summary: string | null;
  skills: string | null;
  tools: string | null;
  languages: string | null;
  target_role: string | null;
  target_industries: string | null;
  preferred_work_format: string | null;
  // Structured salary expectation. Replaces the legacy salary_expectation
  // text column; the migration in 20260501000000_split_salary.sql keeps the
  // legacy column around for historical rows but new code reads/writes
  // these four fields only.
  salary_currency: Currency | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: SalaryPeriod | null;
  raw_cv_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileInput {
  full_name: string;
  current_role: string;
  location: string;
  email: string;
  linkedin_url: string;
  portfolio_url: string;
  preferred_language: Language;
  years_of_experience: string;
  professional_summary: string;
  skills: string;
  tools: string;
  languages: string;
  target_role: string;
  target_industries: string;
  preferred_work_format: string;
  salary_currency: Currency | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: SalaryPeriod | null;
  raw_cv_text: string;
}

export const EMPTY_PROFILE_INPUT: ProfileInput = {
  full_name: "",
  current_role: "",
  location: "",
  email: "",
  linkedin_url: "",
  portfolio_url: "",
  preferred_language: "en",
  years_of_experience: "",
  professional_summary: "",
  skills: "",
  tools: "",
  languages: "",
  target_role: "",
  target_industries: "",
  preferred_work_format: "",
  salary_currency: null,
  salary_min: null,
  salary_max: null,
  salary_period: null,
  raw_cv_text: "",
};

export function profileToInput(p: UserProfile): ProfileInput {
  return {
    full_name: p.full_name ?? "",
    current_role: p.current_role ?? "",
    location: p.location ?? "",
    email: p.email ?? "",
    linkedin_url: p.linkedin_url ?? "",
    portfolio_url: p.portfolio_url ?? "",
    preferred_language: p.preferred_language,
    years_of_experience: p.years_of_experience ?? "",
    professional_summary: p.professional_summary ?? "",
    skills: p.skills ?? "",
    tools: p.tools ?? "",
    languages: p.languages ?? "",
    target_role: p.target_role ?? "",
    target_industries: p.target_industries ?? "",
    preferred_work_format: p.preferred_work_format ?? "",
    salary_currency: p.salary_currency,
    salary_min: p.salary_min,
    salary_max: p.salary_max,
    salary_period: p.salary_period,
    raw_cv_text: p.raw_cv_text ?? "",
  };
}

export const JOB_STATUSES: JobStatus[] = [
  "saved",
  "applied",
  "interview",
  "offer",
  "rejected",
];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};
