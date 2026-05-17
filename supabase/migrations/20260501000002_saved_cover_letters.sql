-- "My letters" — user-curated cover letters saved deliberately.
-- Distinct from public.cover_letters, which is the auto-saved audit log
-- of every generation. Idempotent — safe to re-run.

create table if not exists public.saved_cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  job_title text,
  company_name text,
  created_at timestamptz not null default now()
);

create index if not exists saved_cover_letters_user_id_idx
  on public.saved_cover_letters(user_id);
create index if not exists saved_cover_letters_user_recent_idx
  on public.saved_cover_letters(user_id, created_at desc);

alter table public.saved_cover_letters enable row level security;

drop policy if exists "saved_cover_letters_owner_all"
  on public.saved_cover_letters;
create policy "saved_cover_letters_owner_all"
  on public.saved_cover_letters for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
