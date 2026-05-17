import {
  SELECTABLE_LANGUAGE_LEVELS,
  type Language,
  type LanguageEntry,
  type LanguageLevel,
  type ProfileInput,
  type SalaryParts,
  type UserProfile,
} from "@/lib/types";

// =============================================================
// Form-state shape
// =============================================================

export interface ProfileFormState {
  full_name: string;
  current_role: string;
  location: string;
  email: string;
  linkedin_url: string;
  portfolio_url: string;
  preferred_language: Language;
  years_of_experience: string;
  professional_summary: string;
  skills: string[];
  tools: string[];
  languages: LanguageEntry[];
  target_role: string;
  target_industries: string[];
  preferred_work_format: string;
  salary: SalaryParts;
  raw_cv_text: string;
}

export const EMPTY_PROFILE_FORM: ProfileFormState = {
  full_name: "",
  current_role: "",
  location: "",
  email: "",
  linkedin_url: "",
  portfolio_url: "",
  preferred_language: "en",
  years_of_experience: "",
  professional_summary: "",
  skills: [],
  tools: [],
  languages: [],
  target_role: "",
  target_industries: [],
  preferred_work_format: "",
  salary: { currency: "USD", period: "monthly", min: "", max: "" },
  raw_cv_text: "",
};

// =============================================================
// Tag list ↔ comma-separated string
// =============================================================

export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function serializeTags(tags: string[]): string {
  return tags
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .join(", ");
}

// =============================================================
// Languages JSON ↔ string column (with plain-text fallback)
// =============================================================

function isSelectableLevel(v: unknown): v is LanguageLevel {
  return (
    typeof v === "string" &&
    (SELECTABLE_LANGUAGE_LEVELS as string[]).includes(v as string)
  );
}

function normalizeLevel(s: string): LanguageLevel {
  const lower = s.trim().toLowerCase();
  switch (lower) {
    case "native":
      return "Native";
    case "fluent":
      return "Fluent";
    case "advanced":
      return "Advanced";
    case "intermediate":
      return "Intermediate";
    case "basic":
      return "Basic";
    default:
      return "Unknown";
  }
}

// Old plain-text rows like "English, Armenian" or "English (fluent), Armenian".
function fallbackParseLanguages(raw: string): LanguageEntry[] {
  return raw
    .split(/[,;\n]/)
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return null;
      const m = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (m) {
        return { name: m[1].trim(), level: normalizeLevel(m[2]) };
      }
      return { name: trimmed, level: "Unknown" as LanguageLevel };
    })
    .filter((e): e is LanguageEntry => e !== null && e.name.length > 0);
}

export function parseLanguages(
  raw: string | null | undefined,
): LanguageEntry[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Try JSON first (current canonical format).
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(
            (e): e is LanguageEntry =>
              !!e &&
              typeof e === "object" &&
              typeof (e as LanguageEntry).name === "string",
          )
          .map((e) => ({
            name: e.name.trim(),
            level: isSelectableLevel(e.level)
              ? e.level
              : ("Unknown" as LanguageLevel),
          }))
          .filter((e) => e.name.length > 0);
      }
    } catch {
      // Fall through to the plain-text fallback below.
    }
  }

  // Legacy comma-separated text: "English, Armenian" or "English (fluent)".
  return fallbackParseLanguages(trimmed);
}

export function serializeLanguages(entries: LanguageEntry[]): string {
  const valid = entries.filter((e) => e.name.trim().length > 0);
  if (valid.length === 0) return "";
  return JSON.stringify(
    valid.map((e) => ({ name: e.name.trim(), level: e.level })),
  );
}

// =============================================================
// Salary helpers
// =============================================================
// Salary is now stored as four structured columns (salary_currency,
// salary_min, salary_max, salary_period). The form state holds min/max as
// strings since they're driven by <input>; conversion to integers happens
// at the form-state ↔ input boundary.

function parseSalaryNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

// =============================================================
// Row ↔ form state ↔ ProfileInput
// =============================================================

export function formStateFromRow(p: UserProfile): ProfileFormState {
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
    skills: parseTags(p.skills),
    tools: parseTags(p.tools),
    languages: parseLanguages(p.languages),
    target_role: p.target_role ?? "",
    target_industries: parseTags(p.target_industries),
    preferred_work_format: p.preferred_work_format ?? "",
    salary: {
      currency: p.salary_currency ?? "USD",
      period: p.salary_period ?? "monthly",
      min: p.salary_min != null ? String(p.salary_min) : "",
      max: p.salary_max != null ? String(p.salary_max) : "",
    },
    raw_cv_text: p.raw_cv_text ?? "",
  };
}

export function formStateToInput(s: ProfileFormState): ProfileInput {
  // If neither min nor max is filled, we treat the salary as "not provided"
  // and null all four columns to keep the row clean.
  const min = parseSalaryNumber(s.salary.min);
  const max = parseSalaryNumber(s.salary.max);
  const hasSalary = min !== null || max !== null;
  return {
    full_name: s.full_name.trim(),
    current_role: s.current_role.trim(),
    location: s.location.trim(),
    email: s.email.trim(),
    linkedin_url: s.linkedin_url.trim(),
    portfolio_url: s.portfolio_url.trim(),
    preferred_language: s.preferred_language,
    years_of_experience: s.years_of_experience.trim(),
    professional_summary: s.professional_summary.trim(),
    skills: serializeTags(s.skills),
    tools: serializeTags(s.tools),
    languages: serializeLanguages(s.languages),
    target_role: s.target_role.trim(),
    target_industries: serializeTags(s.target_industries),
    preferred_work_format: s.preferred_work_format.trim(),
    salary_currency: hasSalary ? s.salary.currency : null,
    salary_min: min,
    salary_max: max,
    salary_period: hasSalary ? s.salary.period : null,
    raw_cv_text: s.raw_cv_text.trim(),
  };
}

// =============================================================
// Validation
// =============================================================

export type ProfileFieldError = string;
export type ProfileFieldErrors = Partial<
  Record<keyof ProfileFormState, ProfileFieldError>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/.+/i;
// Per spec: LinkedIn URL must start with https://linkedin.com/. Allow a
// leading "www." for forgiveness, but require https.
const LINKEDIN_RE = /^https:\/\/(www\.)?linkedin\.com\/.+/i;

export function validateProfile(s: ProfileFormState): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};

  if (!s.full_name.trim()) errors.full_name = "Full name is required.";
  else if (s.full_name.trim().length > 80)
    errors.full_name = "Max 80 characters.";

  if (!s.current_role.trim()) errors.current_role = "Current role is required.";
  else if (s.current_role.trim().length > 80)
    errors.current_role = "Max 80 characters.";

  if (s.location.trim().length > 80) errors.location = "Max 80 characters.";

  if (!s.email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(s.email.trim()))
    errors.email = "Enter a valid email address.";

  if (s.linkedin_url.trim() && !LINKEDIN_RE.test(s.linkedin_url.trim()))
    errors.linkedin_url = "Must start with https://linkedin.com/";
  if (s.portfolio_url.trim() && !URL_RE.test(s.portfolio_url.trim()))
    errors.portfolio_url = "Must start with http:// or https://";

  if (!s.preferred_language)
    errors.preferred_language = "Preferred language is required.";

  const yoe = s.years_of_experience.trim();
  if (!yoe) errors.years_of_experience = "Years of experience is required.";
  else if (!/^\d+$/.test(yoe))
    errors.years_of_experience = "Numbers only.";
  else {
    const n = Number(yoe);
    if (n < 0 || n > 50)
      errors.years_of_experience = "Must be between 0 and 50.";
  }

  if (s.professional_summary.length > 1400)
    errors.professional_summary = "Max 1400 characters.";

  if (s.skills.length === 0) errors.skills = "Add at least one skill.";
  else if (s.skills.length > 20) errors.skills = "Max 20 skills.";

  if (s.tools.length > 20) errors.tools = "Max 20 tools.";

  if (s.languages.length === 0)
    errors.languages = "Add at least one language.";
  else if (s.languages.some((l) => !l.name.trim()))
    errors.languages = "Every language needs a name.";

  if (!s.target_role.trim()) errors.target_role = "Target role is required.";
  else if (s.target_role.trim().length > 80)
    errors.target_role = "Max 80 characters.";

  if (s.target_industries.length > 10)
    errors.target_industries = "Max 10 industries.";

  // Salary is optional, but if filled we validate format + min ≤ max.
  const minStr = s.salary.min.trim();
  const maxStr = s.salary.max.trim();
  if (minStr && !/^\d+$/.test(minStr)) {
    errors.salary = "Salary must be a whole number.";
  } else if (maxStr && !/^\d+$/.test(maxStr)) {
    errors.salary = "Salary must be a whole number.";
  } else if (minStr && maxStr) {
    const minN = parseInt(minStr, 10);
    const maxN = parseInt(maxStr, 10);
    if (maxN < minN) {
      errors.salary = "Max salary must be at least min.";
    }
  }

  return errors;
}

export function hasErrors(errors: ProfileFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

// =============================================================
// Profile completeness
// =============================================================

// Section weights per spec: 30 / 30 / 20 / 20.
// Inside each section every field counts equally toward the section's score.
// A field is "filled" when its trimmed string / array / salary-range is non-empty.

const ONE = (cond: boolean) => (cond ? 1 : 0);

export function computeCompleteness(s: ProfileFormState): number {
  const filledStr = (v: string) => ONE(v.trim().length > 0);
  const filledArr = (v: unknown[]) => ONE(v.length > 0);

  const basicFields = [
    filledStr(s.full_name),
    filledStr(s.current_role),
    filledStr(s.location),
    filledStr(s.email),
    filledStr(s.linkedin_url),
    filledStr(s.portfolio_url),
    filledStr(s.preferred_language),
  ];
  const basic =
    basicFields.reduce((a, b) => a + b, 0) / basicFields.length;

  const backgroundFields = [
    filledStr(s.years_of_experience),
    filledStr(s.professional_summary),
    filledArr(s.skills),
    filledArr(s.tools),
  ];
  const background =
    backgroundFields.reduce((a, b) => a + b, 0) / backgroundFields.length;

  const languages = filledArr(s.languages);

  const goalsFields = [
    filledStr(s.target_role),
    filledArr(s.target_industries),
    filledStr(s.preferred_work_format),
    ONE(s.salary.min.trim().length > 0 || s.salary.max.trim().length > 0),
  ];
  const goals = goalsFields.reduce((a, b) => a + b, 0) / goalsFields.length;

  return Math.round(basic * 30 + background * 30 + languages * 20 + goals * 20);
}

// Global onboarding gate — users cannot access product features until their
// career profile reaches this completeness. Cover letters, dashboard, etc.
// all use the same threshold.
// Global onboarding gate — users cannot access product features until their
// career profile reaches this completeness. Cover letters, dashboard, etc.
// all use the same threshold.
export const COVER_LETTER_MIN_COMPLETENESS = 80;

// =============================================================
// Step identification — used by the onboarding flow to resume
// at the first incomplete step instead of always from the start.
// Step IDs match the user-facing flow:
//   1. CV source        2. Basic info      3. Background
//   4. Languages        5. Goals           6. Review
// =============================================================

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

// Returns the first manual onboarding step that still has missing required
// fields. Manual steps are:
//   1 Basic info  2 Experience  3 Skills  4 Languages  5 Goals  6 Review
// CV import is intentionally not a step — it's a separate fast-path screen.
export function firstIncompleteStep(s: ProfileFormState): OnboardingStep {
  if (
    !s.full_name.trim() ||
    !s.current_role.trim() ||
    !s.email.trim() ||
    !s.preferred_language
  )
    return 1;

  if (!s.years_of_experience.trim()) return 2;

  if (s.skills.length === 0) return 3;

  if (s.languages.length === 0 || s.languages.some((l) => !l.name.trim()))
    return 4;

  if (!s.target_role.trim()) return 5;

  // All required filled — Review is where the missing-optional hints show
  // what to add to clear the 80% bar.
  return 6;
}
