-- Work links — links to a user's portfolio, GitHub repos, public Figma
-- files, blog posts, App Store listings, etc. Distinct from
-- user_profiles.portfolio_url (single URL): a user may have zero to many
-- links here, and Portfolio is its own first-class section in the app.
-- Idempotent — safe to re-run.

create table if not exists public.work_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  url text not null,
  -- Detected category. Drives validation strategy and how the link is
  -- referenced inside cover letters.
  type text not null check (type in (
    'portfolio','github','figma','dribbble','behance',
    'app_store','article','video','other'
  )),
  title text,
  -- AI-generated short description ("what's inside this link"),
  -- shown on the Portfolio page and used as context when writing
  -- cover letters. The user can edit it after generation.
  summary text,
  -- AI-generated hint for how the cover-letter prompt should
  -- reference this link (e.g. "ref when discussing iOS work").
  -- Also user-editable.
  cover_letter_hint text,
  thumbnail_url text,
  -- Lifecycle: pending = just added, awaiting validation; ready =
  -- validated and visible; broken = previously OK, now unreachable
  -- (e.g. file went private); unsupported = format we don't enrich.
  status text not null default 'pending' check (status in (
    'pending','ready','broken','unsupported'
  )),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_links_user_id_idx
  on public.work_links(user_id);
create index if not exists work_links_user_recent_idx
  on public.work_links(user_id, created_at desc);
-- Prevent the same user from adding the same URL twice.
create unique index if not exists work_links_user_url_unique
  on public.work_links(user_id, url);

alter table public.work_links enable row level security;

drop policy if exists "work_links_owner_all" on public.work_links;
create policy "work_links_owner_all"
  on public.work_links for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Bump updated_at automatically on any row update so the Portfolio
-- page can sort "recently edited" without the client touching it.
create or replace function public.tg_set_work_links_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_work_links_updated_at on public.work_links;
create trigger set_work_links_updated_at
  before update on public.work_links
  for each row execute function public.tg_set_work_links_updated_at();
