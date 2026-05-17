-- Repair: backfill public.users from auth.users + allow self-insert under RLS.
-- Idempotent — safe to run multiple times.

-- 1. Backfill any auth.users that don't yet have a matching public.users row.
--    The handle_new_user trigger normally creates this on signup, but users
--    that predate the trigger (or where it failed) have no row, which causes
--    user_profiles.user_id FK violations on save.
insert into public.users (id, email, name)
select
  au.id,
  coalesce(au.email, ''),
  coalesce(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name'
  )
from auth.users au
where not exists (
  select 1 from public.users pu where pu.id = au.id
);

-- 2. INSERT policy on public.users — lets a logged-in user create their own
--    row from the application server (so ensurePublicUser() can self-heal
--    if a future trigger run is missed).
drop policy if exists "users_insert_self" on public.users;
create policy "users_insert_self"
  on public.users for insert
  with check (auth.uid() = id);
