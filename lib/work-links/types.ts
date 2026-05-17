// Shared types for the Portfolio section. Mirrors the work_links table
// shape — keep in sync with supabase/migrations/20260515000001_work_links.sql.

export type WorkLinkType =
  | "portfolio"
  | "github"
  | "figma"
  | "dribbble"
  | "behance"
  | "app_store"
  | "article"
  | "video"
  | "other";

export type WorkLinkStatus =
  | "pending"
  | "ready"
  | "broken"
  | "unsupported";

export const WORK_LINK_TYPES: ReadonlyArray<WorkLinkType> = [
  "portfolio",
  "github",
  "figma",
  "dribbble",
  "behance",
  "app_store",
  "article",
  "video",
  "other",
];

/**
 * Per-link quality signals captured at validation time. Drives the
 * quality bar on the Portfolio page without re-fetching the source.
 * Shape varies by `kind` — currently only Figma populates rich
 * structural counts; everything else can fall back to metadata-only
 * scoring.
 */
export type QualitySignals =
  | {
      kind: "figma";
      thumbBytes: number;
      pageCount: number;
      frameCount: number;
      namedFrameCount: number;
      componentCount: number;
      styleCount: number;
      textLayerCount: number;
      /** Text layers that look like real content — 3+ chars, contain
       *  a space OR are 8+ chars. Filters out "01", "x", page-number
       *  placeholders and similar noise. */
      meaningfulTextCount: number;
      imageFillCount: number;
      /** True when the deep /v1/files API call failed (rate-limit /
       *  private / network) and the structural counts above couldn't
       *  be filled. Thumbnail-derived signals are still reliable, but
       *  the score caps low to reflect what we actually know. */
      apiBlocked?: boolean;
      /** Representative frame node IDs distributed across pages —
       *  captured during the deep walk. Persisted so a future recheck
       *  can re-render them via /v1/images (a separate quota pool from
       *  /v1/files), giving us fresh Vision input even when the deep
       *  walk endpoint is locked for this file. Stable across edits —
       *  Figma assigns node IDs once and doesn't renumber. */
      topFrameIds?: string[];
      /** Vision-grounded grading of what's actually visible in the
       *  cover image(s) we sent Gemini. Captured during enrichment,
       *  merged into signals before the row is persisted. Used to
       *  differentiate files when the structural walk is unavailable
       *  (api_locked) — e.g. a polished game-UI thumbnail can score
       *  high even when /v1/files is rate-locked, while a blank
       *  placeholder cover stays low. Set conservatively by Gemini:
       *  each flag should require concrete pixel-level evidence, not
       *  inference from the filename. */
      visualQuality?: {
        hasSpecificContent: boolean;
        hasRealUiText: boolean;
        looksFinished: boolean;
        looksBlankOrPlaceholder: boolean;
      };
    }
  | null;

/** Vision-derived grading of the cover image(s). Captured by
 *  enrichWorkLink and merged into QualitySignals.visualQuality before
 *  the row is written. Exported separately so the action layer can
 *  type the merge without re-deriving the shape. */
export type VisualQuality = {
  hasSpecificContent: boolean;
  hasRealUiText: boolean;
  looksFinished: boolean;
  looksBlankOrPlaceholder: boolean;
};

export interface WorkLinkRow {
  id: string;
  user_id: string;
  url: string;
  type: WorkLinkType;
  title: string | null;
  summary: string | null;
  cover_letter_hint: string | null;
  thumbnail_url: string | null;
  status: WorkLinkStatus;
  /**
   * Whether this link is eligible to be referenced in generated cover
   * letters. User toggles it per card. Defaults to true on insert.
   */
  use_in_cover_letter: boolean;
  /** Per-type structural signals (Figma counts, etc.) used by the
   *  quality bar. Null until the source has been validated at least
   *  once with the deep extraction path. */
  quality_signals: QualitySignals;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}
