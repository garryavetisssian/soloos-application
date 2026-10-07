# SoloOS

An independent AI-engineering experiment for evidence-based job applications: structured job research, profile context and discrete AI writing actions in a focused career workspace.

## Stack

- Next.js (App Router) + TypeScript
- TailwindCSS + shadcn/ui (dark professional theme)
- Supabase (Postgres + Auth, Google OAuth)
- Google Gemini (AI assist for resumes & cover letters)

## Publish to GitHub

Publish this repository as-is. No service account, API key, database migration or deployment is required to publish the source. Private environment files, build output and dependencies are ignored. Commit the source, lockfile, migrations and empty `.env.example`.

```bash
npm ci
npm run check
```

GitHub Actions repeats the checks without service credentials on pushes and pull requests. No third-party app installation is required. The publication check scans source and reachable history for common credential patterns without printing values; it is not an exhaustive secret detector.

## Explore without service accounts

Use Node.js 22.12 or newer:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Public pages and the sign-in preview work without credentials. Sign-in stays disabled until configured, protected pages redirect to sign-in, and service-backed API routes return an unavailable response. This is not an offline authenticated workspace.

The first build needs internet access to download Google Fonts, but no Supabase, Gemini or Figma account.

## Optional connected setup

```bash
cp .env.example .env.local      # fill in Supabase + Gemini keys
npm ci
npm run dev
```

Apply all SQL migrations in `supabase/migrations/` in filename order to your own Supabase project, including the cache-quarantine migration. Enable Google OAuth and allow your application's `/auth/callback` URL. Figma enrichment is optional. No remote database is modified automatically, and a service-role key is not required. Never commit real CVs, applicant data or private keys; never put server keys in `NEXT_PUBLIC_*` variables.

## Implemented scope

CV PDF import and profile normalization, public job research, contextual cover-letter drafting, improve/rewrite/shorten/expand/translate actions, screening-question answers, saved letters and multilingual letter PDF export are implemented. Optional public Figma link enrichment supplies portfolio evidence.

The CV builder supports profile-prefilled documents, editable sections, live preview, duplication and multilingual PDF download. The application tracker supports search, five statuses, notes, follow-up dates and links to saved cover letters. Both persist per-user data behind authenticated APIs and the existing database ownership policies.

To keep this MVP simple, CV content is stored as versioned JSON in `resumes.summary`, and application metadata in `jobs.notes`. Legacy plain-text values remain readable. No additional database migration is required for these features. General portfolio extraction remains incomplete. This is an experiment, not a completed production service or client assignment.

## Project structure

```
app/
  (auth)/login/                 Google sign-in
  (app)/                        Protected app shell (sidebar + workspace)
    dashboard/
    cvs/  cvs/[id]/             Planned builder / editor scaffold
    cover-letters/              AI cover letter generator
    jobs/                       Application tracker
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
- User-owned tables use RLS keyed on `auth.uid()`; a trigger on `auth.users` mirrors signups into `public.users`. The old shared Figma cache is disabled and quarantined by migration.
- AI is exposed as discrete actions (Improve / Rewrite / Shorten / Expand) — never as a chat surface.
- Resume export filename convention: `First_Last_Position_CV_<LANG>.pdf` (see `lib/export/filename.ts`).
- Supported document languages: `en`, `ru`, `hy`.

## Verification and security

`npm test` runs outbound-request security regressions; `npm run typecheck`, `npm run lint` and `npm run build` check the implementation. `npm run check:publish` checks source publication. `npm run check` combines publication checks, tests, types and production build (which also lints).

See [SECURITY.md](SECURITY.md) for boundaries and limitations. Publishing source does not update an existing deployment or apply remote database migrations. AI output requires human review; schema validation does not guarantee accuracy or eliminate prompt injection.
