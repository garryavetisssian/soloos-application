-- Extend saved_cover_letters with the metadata the new library / detail
-- pages need: language, source_type + source URL/description for
-- regeneration, cached job_research blob, updated_at for edit ordering.
-- Idempotent — safe to re-run.

alter table public.saved_cover_letters
  add column if not exists language text
    check (language in ('English', 'Russian', 'Armenian')),
  add column if not exists source_type text
    check (source_type in ('manual', 'job_link')),
  add column if not exists source_url text,
  add column if not exists job_description text,
  add column if not exists job_research jsonb,
  add column if not exists updated_at timestamptz not null default now();

-- updated_at trigger — bumps on any row update so the library can sort
-- "recently edited" without the client having to set it explicitly.
create or replace function public.tg_set_saved_cover_letters_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_saved_cover_letters_updated_at
  on public.saved_cover_letters;
create trigger set_saved_cover_letters_updated_at
  before update on public.saved_cover_letters
  for each row execute function public.tg_set_saved_cover_letters_updated_at();

-- Index for the library "recently edited" view. The user_id+created_at
-- index from the original migration is still useful for "first created"
-- listings, so we keep both.
create index if not exists saved_cover_letters_user_updated_idx
  on public.saved_cover_letters(user_id, updated_at desc);

-- RLS already enabled in the original migration with the
-- "saved_cover_letters_owner_all" policy (auth.uid() = user_id for both
-- using and with check). No changes needed here — owner-only FOR ALL
-- already covers SELECT / INSERT / UPDATE / DELETE for the new columns.
