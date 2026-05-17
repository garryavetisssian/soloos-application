-- Robust user lifecycle: signup mirroring, deletion cleanup, dev reset.
-- Idempotent — safe to re-run. Uses CREATE OR REPLACE for functions and
-- DROP IF EXISTS / CREATE for triggers.
--
-- Why this exists
-- ---------------
-- All user-owned tables already FK-reference public.users(id) ON DELETE
-- CASCADE, and public.users(id) FK-references auth.users(id) ON DELETE
-- CASCADE. So in theory deleting from auth.users cascades cleanly. In
-- practice, two paper cuts have caused breakage during testing:
--
--   1. The previous handle_new_user used ON CONFLICT (id) DO NOTHING. If
--      a stale public.users row with the same email but a different id
--      survives (because someone deleted via a path that didn't cascade,
--      or because the row pre-dates the current trigger), the email
--      UNIQUE constraint trips on next signup.
--
--   2. There was no manual reset path. Cleaning up by hand is error-prone.
--
-- The migration does three things:
--   A. Make handle_new_user self-healing: defensively delete orphan
--      email rows before inserting; switch to ON CONFLICT (id) DO UPDATE
--      so a re-run is also tolerant.
--   B. Add an explicit on_auth_user_deleted trigger as belt-and-braces.
--      The FK cascade already handles deletion; this guarantees cleanup
--      stays correct if cascade is ever changed.
--   C. Add a dev-only reset_test_user(email, delete_auth) function so we
--      stop running ad-hoc DELETE statements during testing.

-- ============================================================
-- A. handle_new_user — self-healing INSERT mirror
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Remove any public.users row that has this email but a different id
  -- AND no longer maps to a real auth.users row. That's the orphan-after
  -- -manual-delete case. Cascade removes downstream rows in user_profiles,
  -- resumes (+experiences), jobs, cover_letters automatically.
  delete from public.users pu
  where pu.email = new.email
    and pu.id <> new.id
    and not exists (
      select 1 from auth.users au where au.id = pu.id
    );

  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(public.users.name, excluded.name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- B. handle_user_delete — defensive mirror cleanup on auth delete
-- ============================================================
-- The FK on public.users.id REFERENCES auth.users(id) ON DELETE CASCADE
-- already removes the mirror row. This trigger is a safety net so the
-- mirror row is also cleaned by an explicit AFTER DELETE if anyone ever
-- alters the FK or removes the cascade clause.
create or replace function public.handle_user_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.users where id = old.id;
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.handle_user_delete();

-- ============================================================
-- C. reset_test_user — dev/admin reset helper
-- ============================================================
-- Run from Supabase SQL Editor:
--   select public.reset_test_user('me@example.com');
--   select public.reset_test_user('me@example.com', false);  -- keep auth.users
--
-- It clears any public.users row(s) with that email (cascade removes
-- their downstream data), then optionally deletes auth.users by email
-- (cascade re-cleans any rows recreated in between). Idempotent.
create or replace function public.reset_test_user(
  target_email text,
  delete_auth boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  delete from public.users where email = target_email;

  if delete_auth then
    select id into v_user_id from auth.users
      where email = target_email
      limit 1;
    if v_user_id is not null then
      delete from auth.users where id = v_user_id;
    end if;
  end if;
end;
$$;

-- Lock the function down: developers / SQL Editor (postgres + service_role)
-- only. Application clients (anon, authenticated) must never call this.
revoke all on function public.reset_test_user(text, boolean) from public;
revoke all on function public.reset_test_user(text, boolean) from anon, authenticated;
grant execute on function public.reset_test_user(text, boolean) to service_role;
