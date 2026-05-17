-- SoloOS initial schema
-- Tables: users, resumes, experiences, jobs, cover_letters

create extension if not exists "pgcrypto";

-- =========================================================
-- users (mirrors auth.users)
-- =========================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  language text not null default 'en' check (language in ('en','ru','hy')),
  created_at timestamptz not null default now()
);

-- =========================================================
-- resumes
-- =========================================================
create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  summary text,
  language text not null default 'en' check (language in ('en','ru','hy')),
  created_at timestamptz not null default now()
);
create index resumes_user_id_idx on public.resumes(user_id);

-- =========================================================
-- experiences
-- =========================================================
create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  company text not null,
  role text not null,
  description text,
  start_date date,
  end_date date
);
create index experiences_resume_id_idx on public.experiences(resume_id);

-- =========================================================
-- jobs
-- =========================================================
create type public.job_status as enum (
  'saved','applied','interview','offer','rejected'
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  company text not null,
  position text not null,
  link text,
  status public.job_status not null default 'saved',
  notes text,
  created_at timestamptz not null default now()
);
create index jobs_user_id_idx on public.jobs(user_id);
create index jobs_user_status_idx on public.jobs(user_id, status);

-- =========================================================
-- cover_letters
-- =========================================================
create table public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  job_description text not null,
  generated_text text not null,
  created_at timestamptz not null default now()
);
create index cover_letters_user_id_idx on public.cover_letters(user_id);

-- =========================================================
-- Auto-provision row in public.users on signup
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- Row Level Security
-- =========================================================
alter table public.users           enable row level security;
alter table public.resumes         enable row level security;
alter table public.experiences     enable row level security;
alter table public.jobs            enable row level security;
alter table public.cover_letters   enable row level security;

-- users: each user can read/update their own row only
create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id);

-- resumes
create policy "resumes_owner_all"
  on public.resumes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- experiences (scoped via resume ownership)
create policy "experiences_owner_all"
  on public.experiences for all
  using (
    exists (
      select 1 from public.resumes r
      where r.id = experiences.resume_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.resumes r
      where r.id = experiences.resume_id and r.user_id = auth.uid()
    )
  );

-- jobs
create policy "jobs_owner_all"
  on public.jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- cover_letters
create policy "cover_letters_owner_all"
  on public.cover_letters for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
