# SoloOS Redesign — "Clean Slate" Design System

**Date:** 2026-05-26
**Status:** Approved
**Scope:** Full visual redesign of all existing pages. No new functionality. Polished empty states for the two stub modules (CV builder, Job tracker).

---

## 1. Why

The product is a Career & Freelance OS (CV builder + AI cover letters + job tracker + portfolio). The current UI ("Editorial Operator", session S23) is a NY-Times-magazine aesthetic — Fraunces serif, folio numbers, "Letter Nº", cinnabar ink accents, masthead type sizes. It reads as a print publication, not a SaaS product, and the typographic direction has been rejected twice.

This redesign replaces it with a calm, modern, friendly, **Stripe-style clean** SaaS surface that matches the product's original intent (Linear / Raycast / Notion lineage).

## 2. Decisions (locked)

| Decision | Choice |
|----------|--------|
| Aesthetic | Stripe-style clean: light bg, soft shadows, rounded cards, friendly, approachable |
| Theme | Light + dark with a toggle (light is default) |
| Accent | Emerald / teal |
| Typography | Geist (sans) everywhere; no serif |
| Scope | Restyle every page. Polished empty states for `/cvs` and `/jobs`; do NOT build their functionality |

## 3. Design tokens

### Color — light (default)
- `bg #FFFFFF` · `bg-subtle #F8FAF9` · `surface #FFFFFF` · `surface-2 #F4F6F5`
- `border #E6E9E8` · `border-strong #D4D8D7`
- `text #0F1715` · `text-muted #5B6663` · `text-subtle #8A9491`
- `accent #10B981` · `accent-hover #059669` · `accent-soft #ECFDF5` · ring `#10B981`@30%
- `success #16A34A` · `warning #D97706` · `danger #DC2626`

### Color — dark
- `bg #0B0F0E` · `surface #121716` · `surface-2 #1A211F` · `border #232B29`
- `text #F2F5F4` · `text-muted #9BA6A3`
- `accent #34D399` · `accent-soft #0E1F19`

Tokens are CSS variables in `globals.css`, surfaced through `tailwind.config.ts`. `.dark` class on `<html>` swaps the variable block.

### Typography
- Geist for everything. Drop Fraunces, JetBrains Mono eyebrows, Noto Serif Armenian display. Keep Noto Sans Armenian as the Armenian glyph fallback in the sans stack.
- Scale: `display 36 · h1 28 · h2 22 · h3 18 · body 15 · small 13 · label 12`.
- Line-height: body 1.5–1.6, headings 1.15–1.25. Weights 400 / 500 / 600. Tabular numerals via Geist `font-feature-settings`.
- Remove `eyebrow`, `folio`, `hero 64`, `masthead 88` sizes and all folio/letter-spacing magazine treatments.

### Geometry & elevation
- Radius: `sm 8 · md 10 · lg 12 · xl 16`. Cards 12px.
- Shadows: soft, low-opacity, blurred (Stripe-like) — `sm` (subtle lift), `md` (cards/dropdowns), `lg` (modals). Remove glass inset shadows, primary-glow, cinnabar-glow, ink-rule.

### Motion
- 150ms ease for hovers, 200ms for surface transitions. Gentle fade + 4–8px translate-y on mount (replaces `ink-bloom`). No blur, no theatrical springs.

## 4. Theme toggle
- `.dark` class strategy. Inline `<head>` script reads `localStorage.theme` (falling back to `prefers-color-scheme`) and sets the class before paint — no flash of wrong theme.
- Toggle control (sun/moon) in the top bar. Persists choice to `localStorage`.

## 5. Component primitives (restyle in place)
- `Button` — primary (solid emerald), secondary (subtle gray), ghost, destructive. Soft radius, 150ms.
- `Card` — surface bg, 1px border, soft shadow, 12px radius, optional hover-lift for interactive cards.
- `Input / Textarea / Select` — clean bordered fields, emerald focus ring, no heavy fills.
- New: `Badge`/`Pill` (statuses), `EmptyState` (icon + headline + subtext + CTA) for stub pages, segmented control (channel/tone toggles).

## 6. Layout / shell
- **Sidebar (240px):** wordmark logo, icon+label nav (Dashboard, Cover Letters, CVs, Jobs, Portfolio, Settings). Active item = emerald soft-bg pill + emerald text/icon. Drop folio numbers, serif, "library spine" metaphor.
- **Top bar:** sans page title (no serif), theme toggle, language switcher (clean dropdown, no folio codes), ⌘K command palette trigger.
- **Command palette:** clean rows (icon + label + shortcut hint). Drop folio page numbers and editorial index header.

## 7. Per-page treatment
- **Dashboard** — stat cards (number + label + trend), AI insights, quick actions, recent activity, profile-health bar, pipeline snapshot. Drop "magazine cover-stats."
- **Cover Letters** (library grid, workshop form, detail editor, job-research card, profile-tips) — most-used surface, most polish. Segmented controls for channel/tone, clean generated-letter card.
- **Portfolio** — link cards with thumbnails, classify badges, "use in letter" toggle.
- **CVs & Jobs** — polished empty states; finished-looking, clearly "coming soon," not broken.
- **Settings/profile, onboarding, login, landing** — brought into the system.

## 8. Obsidian brain (living docs)
- Vault: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents`.
- Rewrite the **Design principles** section of `SoloOS — Project Overview.md` (currently documents the old dark-Inter spec).
- Add `SoloOS — Design System.md` — living token/component reference for Clean Slate.
- Append a session log under `SoloOS Sessions/`.

## 9. Execution order
1. Foundation (guarantees consistency): tokens in `globals.css` + `tailwind.config.ts`, theme toggle, primitives, shell (sidebar/top bar/command palette).
2. Pages, inheriting the foundation: dashboard → cover letters → portfolio → CVs/Jobs empty states → settings/onboarding/login/landing.
3. `npm run typecheck` + `npm run dev` for visual verification.

Built with the frontend-design skill for the visual quality bar; coordinated via an architect → coder(s) → reviewer agent team.

## 10. Out of scope
- Building CV builder editor or Job tracker Kanban functionality.
- Backend / schema / AI prompt changes.
- New i18n keys beyond what the restyle requires (existing locale files stay valid).
