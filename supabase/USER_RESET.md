# Resetting a test user

When testing the auth + onboarding flow you sometimes want to wipe a user
so the next sign-in starts at a true clean state. The Supabase dashboard's
"Delete user" button is fine, but a few sharp edges come up if you also
delete rows by hand. Use this instead.

## TL;DR

```sql
-- Supabase Studio → SQL Editor
select public.reset_test_user('me@example.com');
```

That's it. Sign in again with the same Google account; everything is
fresh.

## What it does

1. Removes any `public.users` row(s) with that email. `ON DELETE CASCADE`
   on every user-owned table (`user_profiles`, `jobs`, `cover_letters`,
   `resumes` → `experiences`) wipes their downstream data automatically.
2. Looks up the matching `auth.users` row by email and deletes it. The
   cascade fires again, cleaning up anything that was recreated between
   step 1 and step 2.

The function is idempotent — running it twice in a row is harmless.

## Variants

```sql
-- Keep the auth.users row; only wipe the public profile and downstream data.
select public.reset_test_user('me@example.com', false);
```

Useful when you want to stay logged in and just re-run the onboarding
flow.

## Why we don't just use the dashboard

The dashboard's "Delete user" works correctly *most* of the time — the FK
cascade on `public.users.id REFERENCES auth.users(id) ON DELETE CASCADE`
takes care of the mirror row. The breakage we kept hitting during testing
came from two cases the previous schema didn't handle:

- A `public.users` row with the same email but a stale id existed (e.g.
  because someone deleted only `auth.users` via raw SQL and the cascade
  didn't fire as expected). On next signup the trigger's
  `INSERT … ON CONFLICT (id) DO NOTHING` couldn't help — the email
  UNIQUE constraint tripped.
- The previous trigger silently dropped on conflict, so the new
  `auth.users` row had no `public.users` mirror, and saving a profile
  later failed with a foreign-key error.

Migration `20260501000001_robust_user_lifecycle.sql` makes
`handle_new_user` self-healing (it deletes orphan rows with the same
email before inserting) and adds an explicit `on_auth_user_deleted`
trigger as a belt-and-braces secondary cleanup. Combined with the
`reset_test_user` function, the workflow is now:

```sql
-- Reset
select public.reset_test_user('me@example.com');
-- Sign in via the app. handle_new_user creates the public.users row.
-- Save profile. ensurePublicUser() server-side is a third safety net.
```

## Permissions

`reset_test_user` is `SECURITY DEFINER` and intentionally locked to
`service_role`. The application-facing roles (`anon`, `authenticated`)
cannot call it. Use the SQL Editor (which runs as `postgres`) or any
service-role-keyed admin tool.

## Server-side safety net

The application keeps `ensurePublicUser()` running before every profile
save (`lib/supabase/ensure-public-user.ts`). So even if the trigger ever
silently fails or the user predates it, the next profile save self-heals
the mirror row.
