"use server";

import { revalidatePath } from "next/cache";
import type { EnrichmentResult } from "@/lib/work-links/enrich";
import { enrichWorkLink } from "@/lib/work-links/enrich";
import { parseFigmaFileKey } from "@/lib/work-links/figma";
import {
  isUsefulCacheEntry,
  readFigmaCache,
  writeFigmaCache,
} from "@/lib/work-links/figma-cache";
import type {
  QualitySignals,
  VisualQuality,
  WorkLinkType,
} from "@/lib/work-links/types";
import type { ValidationResult } from "@/lib/work-links/validate";
import { validateWorkLink } from "@/lib/work-links/validate";
import { ensurePublicUser } from "@/lib/supabase/ensure-public-user";
import { createClient } from "@/lib/supabase/server";

// Fold Vision-derived visual_quality onto Figma signals so the row we
// persist has everything the quality bar needs in one place. Non-Figma
// signals (or absent visualQuality) pass through unchanged.
function withVisualQuality(
  base: QualitySignals,
  vq: VisualQuality | undefined,
): QualitySignals {
  if (!base) return base;
  if (base.kind !== "figma") return base;
  if (!vq) return base;
  return { ...base, visualQuality: vq };
}

// Inline copy of validate.ts's URL normalization so we can dedup +
// look up the Figma cache BEFORE paying for /v1/files. Returns the
// normalized https-prefixed URL string, or null when the input isn't
// even a valid URL shape — in which case we short-circuit with the
// same friendly invalid_url error the validator would have produced.
function normalizeRawUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProto).toString();
  } catch {
    return null;
  }
}

// Synthesize a ValidationSuccess + EnrichmentResult pair from a
// Figma cache hit. Lets us bypass /v1/files (rate-limited per file)
// AND the Gemini Vision call entirely on cache-warm adds. The
// downstream insert path doesn't notice the difference — it sees the
// same shapes the live pipeline would have produced.
function buildFromCache(
  normalizedUrl: string,
  fileKey: string,
  cached: NonNullable<Awaited<ReturnType<typeof readFigmaCache>>>,
): { validation: ValidationResult; enriched: EnrichmentResult } {
  const figmaSignals =
    cached.qualitySignals?.kind === "figma" ? cached.qualitySignals : null;
  const validation: ValidationResult = {
    ok: true,
    url: normalizedUrl,
    type: "figma",
    title: cached.title,
    text: cached.textContent ?? "",
    thumbnailUrl: cached.thumbnailUrl,
    figmaFileKey: fileKey,
    figmaFrameIds: figmaSignals?.topFrameIds ?? [],
    qualitySignals: cached.qualitySignals,
  };
  const enriched: EnrichmentResult = {
    summary: cached.summary ?? "",
    coverLetterHint: cached.coverLetterHint ?? "",
    visualQuality: figmaSignals?.visualQuality,
  };
  return { validation, enriched };
}

// ---- Result types ----

export type AddWorkLinkResult =
  | {
      ok: true;
      id: string;
      type: WorkLinkType;
      title: string;
      summary: string;
      coverLetterHint: string;
    }
  | { ok: false; code: string; message: string };

export type MutationResult = { ok: true } | { ok: false; error: string };

// ---- Add: validates → enriches → saves ----

export async function addWorkLinkAction(
  rawUrl: string,
): Promise<AddWorkLinkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Not authenticated. Please sign in again.",
    };
  }

  const ensured = await ensurePublicUser(supabase, user);
  if (!ensured.ok) {
    return {
      ok: false,
      code: "account_setup_failed",
      message: `Couldn't prepare your account: ${ensured.error}`,
    };
  }

  // 1. Cheap pre-flight: normalize URL + dedup BEFORE we touch any
  //    rate-limited APIs. The Figma cache lookup also needs the
  //    parsed file key, so we compute it here once.
  const normalizedUrl = normalizeRawUrl(rawUrl);
  if (!normalizedUrl) {
    return {
      ok: false,
      code: "invalid_url",
      message:
        "That doesn't look like a valid URL. Make sure it starts with http:// or https://.",
    };
  }
  const fileKey = parseFigmaFileKey(normalizedUrl);

  // 2. Reject duplicates up front so we don't waste a Gemini call OR
  //    a Figma /v1/files quota slot on a link we'd reject anyway.
  //
  //    Two layers of dedup:
  //    (a) Exact URL match — same string. Catches the obvious "I
  //        pasted the same link twice" case.
  //    (b) For Figma: same file key, different URL. A Figma file
  //        can be linked via /file/, /design/, or /proto/ paths,
  //        with or without a node-id query selecting a specific
  //        frame/page. All of these refer to the SAME file and
  //        should not be allowed as separate Portfolio entries.
  const { data: existingExact } = await supabase
    .from("work_links")
    .select("id, title")
    .eq("user_id", user.id)
    .eq("url", normalizedUrl)
    .maybeSingle();
  if (existingExact) {
    return {
      ok: false,
      code: "duplicate",
      message: "You've already added this exact link to your Portfolio.",
    };
  }
  if (fileKey) {
    const { data: existingFigma } = await supabase
      .from("work_links")
      .select("url, title")
      .eq("user_id", user.id)
      .eq("type", "figma");
    for (const row of existingFigma ?? []) {
      const existingKey = parseFigmaFileKey(row.url as string);
      if (existingKey === fileKey) {
        const label = (row.title as string | null)?.trim();
        return {
          ok: false,
          code: "duplicate_figma_file",
          message: label
            ? `This is the same Figma file as "${label}" in your Portfolio. Different pages or frames of one file count as one link — open the existing entry to see its content.`
            : "This Figma file is already in your Portfolio (linked under a different URL — possibly a different page or frame of the same file).",
        };
      }
    }
  }

  // 3. Figma cache check. If we've successfully analysed this file
  //    within the cache TTL (whether for this user or another), reuse
  //    the cached enrichment — that's the entire fix for the
  //    delete-then-re-add scenario. Bypasses /v1/files (rate-limited
  //    per file) and Gemini Vision (free-tier daily quota).
  const cached = fileKey ? await readFigmaCache(fileKey) : null;

  let validation: ValidationResult;
  let enriched: EnrichmentResult;

  if (cached && fileKey) {
    ({ validation, enriched } = buildFromCache(normalizedUrl, fileKey, cached));
  } else {
    // 4a. Validate + enrich the live way.
    validation = await validateWorkLink(rawUrl);
    if (!validation.ok) {
      return { ok: false, code: validation.code, message: validation.message };
    }
    enriched = await enrichWorkLink(
      validation.url,
      validation.type,
      validation.text,
      {
        fileKey: validation.figmaFileKey,
        frameIds: validation.figmaFrameIds,
        thumbnailUrl: validation.thumbnailUrl,
      },
    );
    // 4b. Warm the cache so the next add of the same file (this user
    //     or any other) is instant and doesn't re-burn the Figma
    //     quota. ONLY cache useful results — never cache the junk
    //     state where structural failed AND Vision was empty,
    //     because that makes subsequent adds reuse the failure
    //     forever. We deliberately do the cache decision BEFORE we
    //     synthesise a fallback summary below so the fallback never
    //     leaks into the cache as if it were real Vision output.
    if (validation.type === "figma" && validation.figmaFileKey) {
      const cachedSignals = withVisualQuality(
        validation.qualitySignals,
        enriched.visualQuality,
      );
      if (isUsefulCacheEntry(cachedSignals, enriched.summary || null)) {
        await writeFigmaCache({
          fileKey: validation.figmaFileKey,
          title: validation.title,
          summary: enriched.summary || null,
          coverLetterHint: enriched.coverLetterHint || null,
          thumbnailUrl: validation.thumbnailUrl,
          textContent: validation.text || null,
          qualitySignals: cachedSignals,
        });
      }
    }
    // No synthetic fallback summary. When both APIs gave us nothing
    // the row is saved with a null summary and the UI renders the
    // honest "Pending analysis" state from scoreLink. We don't fake
    // content — we tell the user we're waiting.
  }

  // Both branches of the cache-hit / cache-miss split above guarantee
  // an ok validation reaches this point (cache hit synthesizes ok=true;
  // cache miss early-returns on failure). The explicit narrow here is
  // for TypeScript's benefit so the discriminated-union fields below
  // type-check after the `let validation: ValidationResult` declaration.
  if (!validation.ok) {
    return { ok: false, code: validation.code, message: validation.message };
  }

  // 5. Persist. visualQuality from Vision is folded into the
  //    qualitySignals so the score sees both the validator's
  //    structural counts AND Gemini's per-pixel grading in one place.
  const finalSignals = withVisualQuality(
    validation.qualitySignals,
    enriched.visualQuality,
  );
  const { data, error } = await supabase
    .from("work_links")
    .insert({
      user_id: user.id,
      url: validation.url,
      type: validation.type,
      title: validation.title.slice(0, 200),
      summary: enriched.summary.slice(0, 600) || null,
      cover_letter_hint: enriched.coverLetterHint.slice(0, 400) || null,
      thumbnail_url: validation.thumbnailUrl,
      status: "ready",
      last_checked_at: new Date().toISOString(),
      quality_signals: finalSignals,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[addWorkLink] insert failed", {
      userId: user.id,
      code: error.code,
      message: error.message,
    });
    return { ok: false, code: "db_error", message: error.message };
  }

  revalidatePath("/portfolio");
  return {
    ok: true,
    id: data.id as string,
    type: validation.type,
    title: validation.title,
    summary: enriched.summary,
    coverLetterHint: enriched.coverLetterHint,
  };
}

// ---- Update: edit user-facing summary / hint / title ----

interface UpdateInput {
  id: string;
  title?: string | null;
  summary?: string | null;
  cover_letter_hint?: string | null;
  use_in_cover_letter?: boolean;
}

export async function updateWorkLinkAction(
  input: UpdateInput,
): Promise<MutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated." };
  }
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const v = input.title?.trim();
    patch.title = v ? v.slice(0, 200) : null;
  }
  if (input.summary !== undefined) {
    const v = input.summary?.trim();
    patch.summary = v ? v.slice(0, 600) : null;
  }
  if (input.cover_letter_hint !== undefined) {
    const v = input.cover_letter_hint?.trim();
    patch.cover_letter_hint = v ? v.slice(0, 400) : null;
  }
  if (input.use_in_cover_letter !== undefined) {
    patch.use_in_cover_letter = Boolean(input.use_in_cover_letter);
  }
  if (Object.keys(patch).length === 0) return { ok: true };
  const { error } = await supabase
    .from("work_links")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) {
    console.error("[updateWorkLink] update failed", error);
    return { ok: false, error: error.message };
  }
  revalidatePath("/portfolio");
  return { ok: true };
}

// ---- Delete ----

export async function deleteWorkLinkAction(
  id: string,
): Promise<MutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated." };
  }
  const { error } = await supabase
    .from("work_links")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    console.error("[deleteWorkLink] delete failed", error);
    return { ok: false, error: error.message };
  }
  revalidatePath("/portfolio");
  return { ok: true };
}

// ---- Re-check: re-validate an existing link and update status/title ----

export async function recheckWorkLinkAction(
  id: string,
): Promise<MutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated." };
  }

  const { data: row } = await supabase
    .from("work_links")
    .select("url, summary, cover_letter_hint, quality_signals, thumbnail_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) {
    return { ok: false, error: "Link not found." };
  }

  const validation = await validateWorkLink(row.url as string);
  const status = validation.ok ? "ready" : "broken";
  const title = validation.ok ? validation.title.slice(0, 200) : undefined;

  const patch: Record<string, unknown> = {
    status,
    last_checked_at: new Date().toISOString(),
  };
  if (title) patch.title = title;

  // Merge with the previously stored signals before persisting. When
  // /v1/files comes back rate-locked the fresh validation has zero
  // structural counts and `apiBlocked: true` — but the row may already
  // hold a richer snapshot from an earlier successful walk. Keep the
  // richer snapshot in that case so a temporary lock doesn't downgrade
  // a known-good file to "Weak" overnight. The thumbnail size is
  // always freshly probed (cheap, no Figma quota) so we still refresh
  // that even on a merge.
  const previousSignals = (row.quality_signals ?? null) as QualitySignals;
  let mergedSignals: QualitySignals = null;
  if (validation.ok) {
    const freshFigma =
      validation.qualitySignals?.kind === "figma"
        ? validation.qualitySignals
        : null;
    if (
      freshFigma?.apiBlocked &&
      previousSignals?.kind === "figma" &&
      !previousSignals.apiBlocked
    ) {
      mergedSignals = {
        ...previousSignals,
        thumbBytes: freshFigma.thumbBytes || previousSignals.thumbBytes,
      };
    } else {
      mergedSignals = validation.qualitySignals;
    }
    patch.quality_signals = mergedSignals;
  }

  // Decide whether to regenerate the AI summary. For Figma the whole
  // default pipeline is API-free (public HTML scrape + free CDN
  // thumbnail + Gemini Vision) so re-check is cheap to always re-run
  // — that's the path users hit when an old summary looks wrong.
  // For everything else we keep the "only if empty" guard so we
  // don't waste a Gemini call on every cheap link probe.
  const summaryIsEmpty = !(row.summary as string | null | undefined)?.trim();
  const shouldRegenerate =
    validation.ok && (summaryIsEmpty || validation.type === "figma");
  if (shouldRegenerate) {
    // Choose the best available frame IDs for Vision rendering.
    //
    // Preference order:
    //   1. Fresh IDs from THIS validation (only present when /v1/files
    //      responded — i.e. not rate-locked this minute).
    //   2. Frame IDs stored on the row from a prior successful walk.
    //      /v1/images uses a SEPARATE quota pool from /v1/files, so we
    //      can still render fresh frames even when the structural
    //      walk is locked. This is the path that fixes the "every
    //      free-plan file shows the weak api-locked view" complaint:
    //      once a file has been walked once, subsequent rechecks can
    //      always refresh the Vision summary.
    //   3. None — Vision falls back to thumbnail-only.
    const freshIds = validation.ok ? validation.figmaFrameIds ?? [] : [];
    const storedIds =
      previousSignals?.kind === "figma"
        ? previousSignals.topFrameIds ?? []
        : [];
    const frameIds = freshIds.length > 0 ? freshIds : storedIds;
    // File key may not be returned by validation when API was locked,
    // so re-derive from the row URL as a fallback.
    const fileKey =
      (validation.ok ? validation.figmaFileKey : undefined) ??
      parseFigmaFileKey(row.url as string) ??
      undefined;
    const thumbnailUrl = validation.ok
      ? validation.thumbnailUrl
      : (row.thumbnail_url as string | null);
    const enriched = await enrichWorkLink(
      validation.url,
      validation.type,
      validation.text,
      {
        fileKey,
        frameIds,
        thumbnailUrl,
      },
    );
    if (enriched.summary) {
      patch.summary = enriched.summary.slice(0, 600);
      // Only update the hint when Vision actually returned one. If
      // Gemini returned an empty hint on this recheck, KEEP the
      // existing hint rather than wiping it to null — a transient
      // model omission shouldn't erase a previously-good hint the
      // user may have come to rely on. The user can clear the hint
      // explicitly via the edit modal if they want it gone.
      if (enriched.coverLetterHint.trim()) {
        patch.cover_letter_hint = enriched.coverLetterHint.slice(0, 400);
      }
    }
    // Merge fresh visualQuality (if Gemini returned one) into the
    // signals we'll persist below. If Vision failed silently this
    // recheck, retain the previously stored visualQuality rather than
    // dropping it — a transient Gemini error shouldn't downgrade a
    // file that was previously graded as strong.
    const previousVisualQuality =
      previousSignals?.kind === "figma" ? previousSignals.visualQuality : undefined;
    const visualQualityToPersist = enriched.visualQuality ?? previousVisualQuality;
    if (mergedSignals && visualQualityToPersist) {
      patch.quality_signals = withVisualQuality(
        mergedSignals,
        visualQualityToPersist,
      );
    }
    // Warm the cross-user Figma cache with this recheck's freshest
    // successful result. The next add of the same file (deleted then
    // re-added by this user, or added for the first time by anyone
    // else) reuses what we just computed instead of re-burning the
    // Figma per-file quota. We persist whichever signals were richer
    // (mergedSignals already preserves the prior successful walk
    // when the current validation came back apiBlocked).
    if (
      validation.ok &&
      validation.type === "figma" &&
      validation.figmaFileKey
    ) {
      const cachedSignals =
        (patch.quality_signals as QualitySignals | undefined) ?? mergedSignals;
      const summaryToCache =
        (patch.summary as string | undefined) ??
        (row.summary as string | null) ??
        null;
      // Junk-guard mirrors addWorkLinkAction: never cache a recheck
      // result that's worse than nothing — the cache is shared, so
      // polluting it would hurt everyone's next add of this file.
      if (isUsefulCacheEntry(cachedSignals ?? null, summaryToCache)) {
        await writeFigmaCache({
          fileKey: validation.figmaFileKey,
          title:
            (patch.title as string | undefined) ?? validation.title,
          summary: summaryToCache,
          coverLetterHint:
            (patch.cover_letter_hint as string | undefined) ??
            (row.cover_letter_hint as string | null) ??
            null,
          thumbnailUrl: validation.thumbnailUrl,
          textContent: validation.text || null,
          qualitySignals: cachedSignals ?? null,
        });
      }
    }
  }

  const { error } = await supabase
    .from("work_links")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/portfolio");
  return { ok: true };
}
