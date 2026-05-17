-- SoloOS user_profiles — idempotent migration.
-- Safe to re-run: every step uses IF (NOT) EXISTS or DROP ... IF EXISTS.

-- 1. Table
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,

  -- Basic information
  full_name text,
  "current_role" text,
  location text,
  email text,
  linkedin_url text,
  portfolio_url text,
  preferred_language text not null default 'en'
    check (preferred_language in ('en','ru','hy')),

  -- Career background
  years_of_experience text,
  professional_summary text,
  skills text,
  tools text,
  languages text,

  -- Career goals
  target_role text,
  target_industries text,
  preferred_work_format text,
  salary_expectation text,

  -- CV import
  raw_cv_text text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Index
create index if not exists user_profiles_user_id_idx
  on public.user_profiles(user_id);

-- 3. RLS
alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_owner_all" on public.user_profiles;
create policy "user_profiles_owner_all"
  on public.user_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. updated_at trigger (function is shared, safe to redefine)
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_touch_updated_at on public.user_profiles;
create trigger user_profiles_touch_updated_at
  before update on public.user_profiles
  for each row execute function public.touch_updated_at();
