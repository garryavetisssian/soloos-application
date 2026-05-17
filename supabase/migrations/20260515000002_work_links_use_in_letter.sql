-- Per-link toggle for whether this work_link is eligible for cover
-- letter generation. Defaults to true so existing rows stay opt-in.
-- The user can flip individual links off (e.g. a portfolio piece that
-- isn't professional-relevant) without deleting them. Idempotent.

alter table public.work_links
  add column if not exists use_in_cover_letter boolean not null default true;
