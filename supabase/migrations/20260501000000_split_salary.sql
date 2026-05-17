-- Split user_profiles.salary_expectation into structured columns.
-- Idempotent — safe to re-run.
--
-- The legacy `salary_expectation` text column is intentionally kept so that
-- existing rows aren't lost. New application code reads/writes only the four
-- columns added below.

-- 1. Columns
alter table public.user_profiles
  add column if not exists salary_currency text,
  add column if not exists salary_min integer,
  add column if not exists salary_max integer,
  add column if not exists salary_period text;

-- 2. Field-level checks. CHECK constraints don't support IF NOT EXISTS in
--    older Postgres, so the idempotent form is drop-then-add.

alter table public.user_profiles
  drop constraint if exists user_profiles_salary_currency_check;
alter table public.user_profiles
  add constraint user_profiles_salary_currency_check
  check (
    salary_currency is null
    or salary_currency in (
      'USD','EUR','GBP','AMD','RUB','AED','CAD','AUD','PLN','TRY'
    )
  );

alter table public.user_profiles
  drop constraint if exists user_profiles_salary_period_check;
alter table public.user_profiles
  add constraint user_profiles_salary_period_check
  check (
    salary_period is null
    or salary_period in ('monthly','yearly')
  );

alter table public.user_profiles
  drop constraint if exists user_profiles_salary_min_nonneg;
alter table public.user_profiles
  add constraint user_profiles_salary_min_nonneg
  check (salary_min is null or salary_min >= 0);

alter table public.user_profiles
  drop constraint if exists user_profiles_salary_max_nonneg;
alter table public.user_profiles
  add constraint user_profiles_salary_max_nonneg
  check (salary_max is null or salary_max >= 0);

-- 3. Cross-field check: max >= min when both are present.
alter table public.user_profiles
  drop constraint if exists user_profiles_salary_minmax_check;
alter table public.user_profiles
  add constraint user_profiles_salary_minmax_check
  check (
    salary_min is null
    or salary_max is null
    or salary_max >= salary_min
  );
