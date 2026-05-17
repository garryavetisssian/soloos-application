// Cross-user cache of Figma file enrichment.
//
// Why: Figma's free Starter plan rate-locks /v1/files per-file for
// hours-to-days after the per-file quota is exceeded. Without this
// cache, the "delete + re-add the same link" gesture produces a
// strictly worse row the second time (validation comes back
// apiBlocked, Gemini Vision may also be on quota cooldown). The
// cache lets the second add reuse the first add's analysis instead
// of touching the rate-limited APIs.
//
// What's cached: ONLY auto-generated fields derived from a public
// file (title, summary, hint, thumbnail URL, structural signals,
// Vision visualQuality). Per-user state (toggle, custom edits) is
// NEVER written here — it lives on the per-user work_links row.

import { createClient } from "@/lib/supabase/server";
import type { QualitySignals } from "./types";

// 7 days. Long enough to absorb delete+re-add cycles and casual
// re-checks without burning the Figma quota again. Short enough that
// updates to the underlying Figma file get re-analysed within a
// week. Users can force a refresh sooner via the re-check button.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface FigmaCacheEntry {
  fileKey: string;
  title: string;
  summary: string | null;
  coverLetterHint: string | null;
  thumbnailUrl: string | null;
  textContent: string | null;
  qualitySignals: QualitySignals;
  refreshedAt: string;
}

/** Look up a cache entry by Figma file key. Returns null when:
 *   • the row doesn't exist
 *   • the row is older than the TTL
 *   • the row is "junk" — neither real structural signals nor a
 *     Vision summary survived. This guard exists because a prior
 *     failed add (API rate-locked + Vision quota exhausted) used to
 *     write an essentially-empty cache row, and every subsequent
 *     add then reused that junk and never tried fresh. Treating
 *     junk as miss lets the next attempt try the live APIs again. */
export async function readFigmaCache(
  fileKey: string,
): Promise<FigmaCacheEntry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("figma_file_cache")
    .select(
      "file_key, title, summary, cover_letter_hint, thumbnail_url, text_content, quality_signals, refreshed_at",
    )
    .eq("file_key", fileKey)
    .maybeSingle();
  if (error) {
    console.warn("[figma-cache] read failed", error.message);
    return null;
  }
  if (!data) return null;
  const refreshedAt = data.refreshed_at as string;
  const age = Date.now() - new Date(refreshedAt).getTime();
  if (!Number.isFinite(age) || age > CACHE_TTL_MS) return null;
  const qualitySignals = (data.quality_signals as QualitySignals) ?? null;
  const summary = (data.summary as string | null) ?? null;
  if (!isUsefulCacheEntry(qualitySignals, summary)) return null;
  return {
    fileKey: data.file_key as string,
    title: data.title as string,
    summary,
    coverLetterHint: (data.cover_letter_hint as string | null) ?? null,
    thumbnailUrl: (data.thumbnail_url as string | null) ?? null,
    textContent: (data.text_content as string | null) ?? null,
    qualitySignals,
    refreshedAt,
  };
}

/** A cache entry is worth reusing when it represents an actual
 *  successful analysis — either the structural walk succeeded (so
 *  apiBlocked is false) OR Vision produced a non-empty summary.
 *  Without either, we'd just be reusing a previous failure. */
export function isUsefulCacheEntry(
  qualitySignals: QualitySignals,
  summary: string | null,
): boolean {
  const figmaSignals =
    qualitySignals?.kind === "figma" ? qualitySignals : null;
  const structuralOk = !!figmaSignals && figmaSignals.apiBlocked !== true;
  const summaryOk = (summary ?? "").trim().length > 0;
  return structuralOk || summaryOk;
}

/** Upsert a cache entry. Soft-fails on write errors — caching is a
 *  best-effort optimisation; a write failure should never break the
 *  add/recheck flow that called us. */
export async function writeFigmaCache(
  entry: Omit<FigmaCacheEntry, "refreshedAt">,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("figma_file_cache").upsert(
    {
      file_key: entry.fileKey,
      title: entry.title.slice(0, 200),
      summary: entry.summary?.slice(0, 600) ?? null,
      cover_letter_hint: entry.coverLetterHint?.slice(0, 400) ?? null,
      thumbnail_url: entry.thumbnailUrl,
      text_content: entry.textContent?.slice(0, 20_000) ?? null,
      quality_signals: entry.qualitySignals,
      refreshed_at: new Date().toISOString(),
    },
    { onConflict: "file_key" },
  );
  if (error) console.warn("[figma-cache] write failed", error.message);
}
