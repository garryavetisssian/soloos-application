-- Global cache of Figma file enrichment results, keyed by file_key.
--
-- Why this exists: Figma's free Starter plan rate-locks /v1/files
-- per-file for hours-to-days after the per-file quota is exceeded.
-- Without a cache, the obvious user gesture of deleting and
-- re-adding the same link produces a near-empty row the second time
-- (validation comes back apiBlocked + the Vision call may also fail
-- under quota pressure). The cache makes the second add reuse the
-- first add's successful analysis.
--
-- Cross-user: the underlying Figma file is publicly viewable, and we
-- only cache the AUTO-generated enrichment fields (summary, hint,
-- thumbnail URL, structural signals, Vision visualQuality). Per-user
-- state — toggle on/off, custom title/summary edits — stays on the
-- per-user work_links row and is never written here.
CREATE TABLE IF NOT EXISTS figma_file_cache (
  file_key text PRIMARY KEY,
  -- File name as Figma reported it. Used as the default title when
  -- a row is created from cache.
  title text NOT NULL,
  -- Auto-generated enrichment outputs. NULL when Gemini didn't
  -- produce a value on the call that populated the cache (we still
  -- cache the row so later adds avoid the Figma rate-limit cost).
  summary text,
  cover_letter_hint text,
  thumbnail_url text,
  -- Synthesised text doc handed to the Vision prompt as metadata
  -- (page names, frame names, text-layer content from the deep
  -- walk). Persisted so a cached re-add doesn't lose the Vision
  -- input it would normally re-derive from /v1/files.
  text_content text,
  -- Structural counts + Vision visualQuality as captured at write
  -- time. Same shape as work_links.quality_signals.
  quality_signals jsonb,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS figma_file_cache_refreshed_at_idx
  ON figma_file_cache(refreshed_at);

ALTER TABLE figma_file_cache ENABLE ROW LEVEL SECURITY;

-- Permissive RLS: cache content is derived from PUBLIC Figma files,
-- contains no PII, and is intentionally shared across users (one
-- user's add warms the cache for everyone). Any authenticated user
-- can read, insert, or upsert.
DROP POLICY IF EXISTS "authenticated read figma cache" ON figma_file_cache;
CREATE POLICY "authenticated read figma cache"
  ON figma_file_cache FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated write figma cache" ON figma_file_cache;
CREATE POLICY "authenticated write figma cache"
  ON figma_file_cache FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated update figma cache" ON figma_file_cache;
CREATE POLICY "authenticated update figma cache"
  ON figma_file_cache FOR UPDATE TO authenticated USING (true);
