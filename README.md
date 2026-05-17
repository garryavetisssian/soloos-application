# SoloOS

Career & Freelance Operating System — resumes, AI-generated cover letters, and a job application tracker, in one workspace.

## Stack

- Next.js (App Router) + TypeScript
- TailwindCSS + shadcn/ui (dark professional theme)
- Supabase (Postgres + Auth, Google OAuth)
- Google Gemini (AI assist for resumes & cover letters)

## Getting started

```bash
cp .env.example .env.local      # fill in Supabase + Gemini keys
npm install
npm run dev
```

Apply the database schema in `supabase/migrations/` (Supabase CLI: `supabase db push`).

## Project structure

```
app/
  (auth)/login/                 Google sign-in
  (app)/                        Protected app shell (sidebar + workspace)
    dashboard/
    resumes/  resumes/[id]/     Editor: section list / editor / live preview
    cover-letters/              AI cover letter generator
    jobs/                       Kanban tracker (saved → applied → interview → offer → rejected)
    settings/
  api/ai/                       Gemini-backed endpoints
  auth/callback/                Supabase OAuth callback
  page.tsx                      Landing
components/
  ui/                           shadcn primitives
  layout/sidebar.tsx
lib/
  supabase/{client,server,middleware}.ts
  gemini/{client,prompts}.ts
  export/filename.ts
  types.ts  utils.ts
supabase/migrations/            SQL schema with RLS
middleware.ts                   Auth session refresh + route protection
```

## Architecture notes

- All app routes under `(app)/` are protected by `middleware.ts` — unauthenticated users redirect to `/login`.
- All tables use RLS keyed on `auth.uid()`; a trigger on `auth.users` mirrors signups into `public.users`.
- AI is exposed as discrete actions (Improve / Rewrite / Shorten / Expand) — never as a chat surface.
- Resume export filename convention: `First_Last_Position_CV_<LANG>.pdf` (see `lib/export/filename.ts`).
- Supported document languages: `en`, `ru`, `hy`.
