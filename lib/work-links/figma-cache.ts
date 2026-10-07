// Shared cache quarantined until entries have server-owned writes and
// per-file authorization. Keep the interface so live enrichment still works.
import type { QualitySignals } from "./types";
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
export async function readFigmaCache(_fileKey: string): Promise<FigmaCacheEntry | null> { return null; }
export function isUsefulCacheEntry(qualitySignals: QualitySignals, summary: string | null): boolean {
  return (qualitySignals?.kind === "figma" && qualitySignals.apiBlocked !== true) || (summary ?? "").trim().length > 0;
}
export async function writeFigmaCache(_entry: Omit<FigmaCacheEntry, "refreshedAt">): Promise<void> {
  // Intentionally disabled. Apply the cache quarantine migration as well.
}
