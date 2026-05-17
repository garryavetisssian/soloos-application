// Per-link quality score (0–100) for the Portfolio page.
//
// Honest design principle: every point in the score is grounded in
// something we actually observed about the file. For Figma we lean on
// structural counts captured during validation. Generic / placeholder
// data ACTIVELY costs points rather than just failing to gain them —
// a file with 60 frames named "Frame 145" is worse than an empty file
// because it would feed garbage into the cover letter.
//
// What the score is NOT: a judgement of artistic quality, brand
// strength, or how impressive the work is. It only measures whether
// SoloOS has enough material to reference this link confidently in a
// cover letter.

import type { QualitySignals, VisualQuality, WorkLinkRow } from "./types";

export type QualityBand = "pending" | "weak" | "basic" | "good" | "great";

export type IssueKey =
  | "broken"
  | "pending"
  | "toggle_off"
  | "generic_title"
  | "vague_summary"
  | "no_summary"
  | "no_hint"
  | "sparse_thumbnail"
  | "few_pages"
  | "few_named_frames"
  | "no_named_frames"
  | "noisy_frames"
  | "no_components"
  | "no_text_content"
  | "placeholder_text"
  | "signals_missing"
  | "api_locked"
  | "visualquality_missing"
  | "cover_looks_blank"
  | "analysis_pending";

export interface LinkQuality {
  score: number;
  band: QualityBand;
  /** Priority-ordered hints — first is the most impactful fix. */
  issues: IssueKey[];
  /** Human-readable signal pills shown under the bar. */
  breakdown: { labelKey: string; value: string; tone?: "warn" }[];
  /** True when the score is below the usable threshold — UI locks the
   *  toggle and the cover-letter route filters this link out. */
  blocked: boolean;
}

/** Below this score, a link cannot be used in cover-letter
 *  generation regardless of the user's toggle. Set low (30) so the
 *  hard block reserves itself for the genuinely-useless files (blank
 *  covers, un-graded rows, noisy Frame-145 dumps). Everything else
 *  is the user's call via the toggle. */
export const LINK_USAGE_THRESHOLD = 30;

// =============================================================
// Helpers
// =============================================================

const GENERIC_TITLE_RE =
  /^(untitled|untitled\s*\d*|document|design|prototype|sketch|new\s+(file|page|frame|design)|page\s*\d*|frame\s*\d*|file|portfolio|work)$/i;

const HEDGE_PATTERNS: RegExp[] = [
  /\blikely (contains|details|showcases|is)\b/gi,
  /\bappears? to (be|contain|showcase)\b/gi,
  /\bshowcases? design work\b/gi,
  /\bdesign work or prototypes\b/gi,
];

function isGenericTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  return GENERIC_TITLE_RE.test(t);
}

function isVagueSummary(summary: string): boolean {
  for (const re of HEDGE_PATTERNS) {
    if (re.test(summary)) return true;
  }
  return false;
}

function bandFor(score: number): QualityBand {
  if (score < 30) return "weak";
  if (score < 55) return "basic";
  if (score < 80) return "good";
  return "great";
}

// =============================================================
// Public entry point
// =============================================================

export function scoreLink(link: WorkLinkRow): LinkQuality {
  if (link.status === "broken") {
    return {
      score: 0,
      band: "weak",
      issues: ["broken"],
      breakdown: [],
      blocked: true,
    };
  }
  if (link.status !== "ready") {
    return {
      score: 0,
      band: "weak",
      issues: ["pending"],
      breakdown: [],
      blocked: true,
    };
  }

  // Honest "pending analysis" state. When a Figma file tried to
  // analyze but BOTH the structural walk (apiBlocked) and Vision
  // (no summary, no visualQuality) came back empty, the link isn't
  // "weak" — it's un-analyzed. On Figma's free plan a per-file API
  // lock can last up to ~3 days. Surface that honestly instead of
  // showing a misleading low score with a "Needs work" verdict.
  if (isAnalysisPending(link)) {
    return {
      score: 0,
      band: "pending",
      issues: ["analysis_pending"],
      breakdown: [],
      blocked: true,
    };
  }

  // Figma links MUST be scored against structural signals. If the row
  // was created before we captured signals (and hasn't been re-checked
  // yet), there's literally no signal data to evaluate — force a
  // re-check rather than fall back to metadata-only scoring (which
  // would let a hallucinated summary produce a fake "Strong" rating).
  if (link.type === "figma" && !link.quality_signals) {
    return {
      score: 20,
      band: "weak",
      issues: ["signals_missing"],
      breakdown: [],
      blocked: true,
    };
  }

  const quality =
    link.quality_signals?.kind === "figma"
      ? scoreFigma(link, link.quality_signals)
      : scoreMetadataOnly(link);
  quality.blocked = quality.blocked || quality.score < LINK_USAGE_THRESHOLD;
  return quality;
}

/** True when a Figma row has been added/rechecked but we couldn't
 *  produce ANY analysis: the structural walk was api-blocked, Vision
 *  returned no visualQuality, and no summary survived. The right UX
 *  for these is "Pending — re-check later" rather than the misleading
 *  "Needs work" verdict. Status must be "ready" — broken / pending
 *  status rows are handled by their own branches above. */
export function isAnalysisPending(link: WorkLinkRow): boolean {
  if (link.type !== "figma") return false;
  if (link.status !== "ready") return false;
  const sigs =
    link.quality_signals?.kind === "figma" ? link.quality_signals : null;
  if (!sigs) return false;
  const apiBlocked = sigs.apiBlocked === true;
  const noVisualQuality = !sigs.visualQuality;
  const noSummary = (link.summary ?? "").trim().length === 0;
  return apiBlocked && noVisualQuality && noSummary;
}

// =============================================================
// Figma scoring — grounded in structural signals
// =============================================================

function scoreFigma(
  link: WorkLinkRow,
  s: Extract<QualitySignals, { kind: "figma" }>,
): LinkQuality {
  // Special case: API was blocked so we don't have structural signals
  // — only the file name and the thumbnail size. We score honestly on
  // those two and surface the real reason ("api_locked") so users
  // understand WHY the score is low (not that we forgot to check).
  if (s.apiBlocked) {
    return scoreFigmaApiBlocked(link, s);
  }

  let score = 0;
  const issues: IssueKey[] = [];

  // ---- Title (15 max) ----
  const title = (link.title ?? "").trim();
  const genericTitle = isGenericTitle(title);
  if (!genericTitle && title.length > 3) score += 15;
  else issues.push("generic_title");

  // ---- Thumbnail (10 max) ----
  if (s.thumbBytes >= 15_000) score += 10;
  else if (s.thumbBytes >= 7_500) score += 5;
  else issues.push("sparse_thumbnail");

  // ---- Pages (10 max) ----
  if (s.pageCount >= 3) score += 10;
  else if (s.pageCount >= 2) score += 5;
  else issues.push("few_pages");

  // ---- Named-frame quality (-15 .. +25) ----
  //
  // The dominant polish signal. Critically, files with many frames but
  // few named ones get an ACTIVE PENALTY — that's noise data which
  // would feed garbage into cover letters, worse than an empty file.
  const namedRatio = s.frameCount > 0 ? s.namedFrameCount / s.frameCount : 0;
  if (s.frameCount === 0) {
    issues.push("no_named_frames");
  } else if (s.namedFrameCount >= 8 && namedRatio >= 0.6) {
    score += 25;
  } else if (s.namedFrameCount >= 5 && namedRatio >= 0.3) {
    score += 12;
    issues.push("few_named_frames");
  } else if (s.namedFrameCount >= 3) {
    score += 3;
    issues.push("few_named_frames");
  } else if (s.frameCount >= 20) {
    // 20+ frames, almost none named → actively noisy file
    score -= 15;
    issues.push("noisy_frames");
  } else if (s.namedFrameCount >= 1) {
    issues.push("few_named_frames");
  } else {
    issues.push("no_named_frames");
  }

  // ---- Components (15 max) ----
  if (s.componentCount >= 10) score += 15;
  else if (s.componentCount >= 3) score += 10;
  else if (s.componentCount >= 1) score += 5;
  else issues.push("no_components");

  // ---- Styles (10 max) ----
  if (s.styleCount >= 5) score += 10;
  else if (s.styleCount >= 1) score += 5;

  // ---- Meaningful text content (-10 .. +15) ----
  //
  // Real product copy ("Sign in", "Welcome") earns. Placeholder noise
  // ("01", "1", "x") is detected by meaningfulTextCount being far
  // below textLayerCount and incurs a penalty.
  if (s.meaningfulTextCount >= 30) {
    score += 15;
  } else if (s.meaningfulTextCount >= 10) {
    score += 8;
  } else if (s.meaningfulTextCount >= 3) {
    score += 3;
  }
  // Placeholder detection: many text layers, few meaningful
  if (s.textLayerCount >= 20 && s.meaningfulTextCount < 5) {
    score -= 10;
    issues.push("placeholder_text");
  } else if (s.meaningfulTextCount === 0 && s.frameCount >= 10) {
    issues.push("no_text_content");
  }

  // ---- Image fills (5 max) ----
  if (s.imageFillCount >= 3) score += 5;

  // ---- Metadata baseline (5 max) ----
  const summary = (link.summary ?? "").trim();
  const hint = (link.cover_letter_hint ?? "").trim();
  if (summary && hint) score += 5;
  if (!summary) issues.push("no_summary");
  else if (isVagueSummary(summary)) issues.push("vague_summary");
  if (summary && !hint) issues.push("no_hint");

  // ---- Vision-grounded modifier (-10 .. +10, plus cap) ----
  //
  // Structural counts tell us how the file is ORGANISED. They cannot
  // tell us whether the visible work looks like polished product
  // design vs a placeholder cover slide that happens to be split
  // across pages. Vision's grading of the cover image(s) IS the
  // signal for visual quality — so a "rich structure but blank
  // cover" file gets capped down, and a "rich structure + polished
  // cover" file gets a small bonus.
  const vq = s.visualQuality;
  if (vq) {
    if (vq.looksBlankOrPlaceholder) {
      score = Math.min(score, 40);
      issues.push("cover_looks_blank");
    } else {
      const positiveFlags =
        (vq.hasSpecificContent ? 1 : 0) +
        (vq.hasRealUiText ? 1 : 0) +
        (vq.looksFinished ? 1 : 0);
      if (positiveFlags === 3) score += 10;
      else if (positiveFlags === 0) score -= 10;
      else if (positiveFlags === 1) score -= 5;
    }
  } else {
    // No Vision grading yet — surface so the user knows to re-check.
    issues.push("visualquality_missing");
  }

  // ---- Caps ----
  if (genericTitle) score = Math.min(score, 30);
  if (summary && isVagueSummary(summary)) score = Math.min(score, 60);

  // Clamp to 0–100 — penalties can push below zero, well-rounded
  // files can stack above 100, neither belongs in the bar.
  score = Math.max(0, Math.min(100, score));

  // Promote the most-impactful issue so the hint line names the
  // single biggest thing to fix.
  if (vq?.looksBlankOrPlaceholder) {
    const i = issues.indexOf("cover_looks_blank");
    if (i > 0) {
      issues.splice(i, 1);
      issues.unshift("cover_looks_blank");
    }
  } else if (genericTitle) {
    const i = issues.indexOf("generic_title");
    if (i > 0) {
      issues.splice(i, 1);
      issues.unshift("generic_title");
    }
  } else if (issues.includes("noisy_frames")) {
    const i = issues.indexOf("noisy_frames");
    if (i > 0) {
      issues.splice(i, 1);
      issues.unshift("noisy_frames");
    }
  }

  // Toggle off doesn't change quality grade — it changes the *blocked*
  // flag. We surface a separate hint when it matters.
  let blocked = false;
  if (!link.use_in_cover_letter) {
    issues.unshift("toggle_off");
    blocked = true;
  }

  return {
    score,
    band: bandFor(score),
    issues,
    breakdown: [...breakdownPills(s, namedRatio), ...visualQualityPills(vq)],
    blocked,
  };
}

// Figma file where the /v1/files structural walk was unavailable
// (rate-locked / private / network). We can't enumerate frames, but
// Gemini Vision DID see the cover image(s) — its `visualQuality`
// flags are the differentiator. A file with a polished, content-rich
// cover (Duck Master) can reach Strong; a blank or title-only cover
// (V Stars sparse, Permanent Makeup Book cover slide) stays low and
// blocked. Without any visualQuality signal we fall back to the
// thumbnail-only score capped at LINK_USAGE_THRESHOLD - 5 so an
// un-graded file never rides into cover letters.
function scoreFigmaApiBlocked(
  link: WorkLinkRow,
  s: Extract<QualitySignals, { kind: "figma" }>,
): LinkQuality {
  let score = 0;
  const issues: IssueKey[] = [];

  // ---- Title (10 max) ----
  const title = (link.title ?? "").trim();
  const genericTitle = isGenericTitle(title);
  if (!genericTitle && title.length > 3) score += 10;
  else issues.push("generic_title");

  // ---- Thumbnail size (10 max) ----
  if (s.thumbBytes >= 15_000) score += 10;
  else if (s.thumbBytes >= 7_500) score += 5;
  else issues.push("sparse_thumbnail");

  // ---- Vision grading (-25 .. +60) ----
  //
  // The cover image carries the only first-hand evidence we have when
  // the API is locked. Trust strict Vision flags accordingly.
  const vq = s.visualQuality;
  if (vq) {
    if (vq.looksBlankOrPlaceholder) {
      // Hard floor: cover shows nothing identifiable. The other
      // positive flags should already be false per prompt rules, but
      // we cap defensively so a contradictory model output can't
      // accidentally promote a placeholder file.
      score = Math.min(score, 25);
    } else {
      if (vq.hasSpecificContent) score += 25;
      if (vq.hasRealUiText) score += 20;
      if (vq.looksFinished) score += 15;
    }
  } else {
    // No Vision grading available (Gemini failed, text-only path).
    // Fall back to the original thumbnail-only cap so an un-graded
    // file can't ride into cover letters on metadata alone.
    score = Math.min(score, LINK_USAGE_THRESHOLD - 5);
  }

  // Surface api_locked ONLY when the score is below the usage
  // threshold — when Vision saw enough to push the link into Good or
  // Strong, the rate-limit becomes a footnote, not the headline. We
  // still want users to know we couldn't do the deep walk, but the
  // weak-state hint is misleading when the cover analysis was rich.
  if (score < LINK_USAGE_THRESHOLD) {
    issues.unshift("api_locked");
  }

  // Clamp and decide blocking from the final score — Vision can push
  // a file above the threshold, in which case the link IS usable.
  score = Math.max(0, Math.min(100, score));
  const blocked = score < LINK_USAGE_THRESHOLD;

  if (!link.use_in_cover_letter) {
    issues.unshift("toggle_off");
  }

  // If Vision hasn't graded the file yet, push the user toward the
  // single highest-impact action: re-check so we can grade it.
  if (!vq) issues.push("visualquality_missing");

  return {
    score,
    band: bandFor(score),
    issues,
    breakdown: visualQualityPills(vq),
    blocked: blocked || !link.use_in_cover_letter,
  };
}

// Vision-grading breakdown. We only render positive signals — each
// pill represents something Gemini actually saw in the cover. Missing
// flags don't get a pill; the score + hint already communicate the
// gaps. This keeps the breakdown read like a "what this link has"
// list rather than a "what this link is missing" checklist, which
// users found confusing.
function visualQualityPills(
  vq: VisualQuality | undefined,
): { labelKey: string; value: string; tone?: "warn" }[] {
  if (!vq) return [];
  // Blank cover collapses to one explicit warning pill — no other
  // flag matters when the cover is empty.
  if (vq.looksBlankOrPlaceholder) {
    return [
      { labelKey: "quality.signal.cover_blank", value: "!", tone: "warn" },
    ];
  }
  const pills: { labelKey: string; value: string; tone?: "warn" }[] = [];
  if (vq.hasSpecificContent) {
    pills.push({ labelKey: "quality.signal.specific_content", value: "✓" });
  }
  if (vq.hasRealUiText) {
    pills.push({ labelKey: "quality.signal.ui_text", value: "✓" });
  }
  if (vq.looksFinished) {
    pills.push({ labelKey: "quality.signal.polished", value: "✓" });
  }
  return pills;
}

function breakdownPills(
  s: Extract<QualitySignals, { kind: "figma" }>,
  namedRatio: number,
): { labelKey: string; value: string; tone?: "warn" }[] {
  const pills: { labelKey: string; value: string; tone?: "warn" }[] = [];
  if (s.pageCount > 0) {
    pills.push({ labelKey: "quality.signal.pages", value: String(s.pageCount) });
  }
  if (s.frameCount > 0) {
    const tone: "warn" | undefined =
      s.frameCount >= 10 && namedRatio < 0.3 ? "warn" : undefined;
    pills.push({
      labelKey: "quality.signal.named_frames",
      value: `${s.namedFrameCount}/${s.frameCount}`,
      tone,
    });
  }
  if (s.componentCount > 0) {
    pills.push({
      labelKey: "quality.signal.components",
      value: String(s.componentCount),
    });
  }
  if (s.styleCount > 0) {
    pills.push({
      labelKey: "quality.signal.styles",
      value: String(s.styleCount),
    });
  }
  if (s.textLayerCount > 0) {
    const tone: "warn" | undefined =
      s.textLayerCount >= 20 && s.meaningfulTextCount < 5 ? "warn" : undefined;
    pills.push({
      labelKey: "quality.signal.meaningful_text",
      value: `${s.meaningfulTextCount}/${s.textLayerCount}`,
      tone,
    });
  }
  if (s.imageFillCount > 0) {
    pills.push({
      labelKey: "quality.signal.images",
      value: String(s.imageFillCount),
    });
  }
  return pills;
}

// =============================================================
// Non-Figma scoring — metadata completeness
// =============================================================

function scoreMetadataOnly(link: WorkLinkRow): LinkQuality {
  let score = 0;
  const issues: IssueKey[] = [];

  const title = (link.title ?? "").trim();
  const titleSpecific = !!title && !isGenericTitle(title);
  if (!titleSpecific) issues.push("generic_title");
  else score += 20;

  const summary = (link.summary ?? "").trim();
  const summaryVague = !!summary && isVagueSummary(summary);
  const summaryRich = !!summary && !summaryVague;
  if (!summary) {
    issues.push("no_summary");
  } else if (summaryVague) {
    score += 20;
    issues.push("vague_summary");
  } else if (summary.length < 80) {
    score += 25;
  } else {
    score += 40;
  }

  const hint = (link.cover_letter_hint ?? "").trim();
  if (hint) score += 20;
  else issues.push("no_hint");

  if (link.use_in_cover_letter) {
    score += 20;
  } else {
    issues.unshift("toggle_off");
  }

  const blocked = !link.use_in_cover_letter;

  // Positive pills for every non-Figma link. We only render what the
  // link HAS so the breakdown reads like an at-a-glance "what's
  // strong" badge row — gaps are described in the hint line below.
  const breakdown: { labelKey: string; value: string; tone?: "warn" }[] = [];
  if (titleSpecific) {
    breakdown.push({ labelKey: "quality.signal.title_set", value: "✓" });
  }
  if (summaryRich) {
    breakdown.push({ labelKey: "quality.signal.summary_set", value: "✓" });
  } else if (summaryVague) {
    breakdown.push({
      labelKey: "quality.signal.summary_vague",
      value: "!",
      tone: "warn",
    });
  }
  if (hint) {
    breakdown.push({ labelKey: "quality.signal.hint_set", value: "✓" });
  }

  return { score, band: bandFor(score), issues, breakdown, blocked };
}
