// Render Figma frames to PNGs via Figma's /v1/images endpoint, then
// pull the PNG bytes and base64-encode them so they can be handed to
// Gemini's multimodal API as inline data.
//
// Why we need this: the /v1/files endpoint only returns the document
// tree (names, geometry, text layers). For files where the designer
// hasn't named frames meaningfully ("Frame 87", "01", "Desktop - 3"),
// names alone are useless. /v1/images lets us SEE the canvas, and
// Gemini Vision can describe what's actually drawn.
//
// Cost: still $0 — both Figma /v1/images and Gemini Flash multimodal
// are free at the volumes we're at.

import sharp from "sharp";
import { safeFetch } from "@/lib/safe-fetch";
import { fetchWithRetryOn429 } from "./figma";

const FIGMA_API_BASE = "https://api.figma.com/v1";
// Lower scale = smaller PNGs = faster downloads + smaller Gemini
// payload. Vision summarisation doesn't need full resolution.
const RENDER_SCALE = 1;
const RENDER_TIMEOUT_MS = 20_000;
const DOWNLOAD_TIMEOUT_MS = 15_000;
// Cap each image at ~3 MB after fetch — Gemini's per-image limit is
// generous but we don't want a runaway file to make us wait.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

// Gemini Vision multimodal accepts PNG, JPEG, WebP, HEIC, HEIF — we
// keep the type permissive because Figma's thumbnail endpoint serves
// WebP to most user-agents (Cloudflare auto-converts), and rendered
// frames are returned as PNG. We sniff the actual bytes rather than
// trusting Content-Type, since the wire format is what Gemini reads.
export type GeminiImageMime =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/heic";

export interface RenderedImage {
  mimeType: GeminiImageMime;
  base64: string;
}

/**
 * Render a list of node IDs in a Figma file as PNGs.
 *
 * Renders each frame in its own /v1/images request so one oversized
 * frame can't cause "Render timeout" for the whole batch (Figma is
 * all-or-nothing per request — see the 400 error we used to hit on
 * V Stars Web's 1.2B-pixel canvas). The per-call timeout is short and
 * any individual failure is logged + silently dropped; partial
 * success is fine because the Vision prompt can summarise from
 * whichever images came through.
 */
/**
 * Download the file's pre-rendered thumbnail PNG.
 *
 * The thumbnailUrl is a pre-signed S3 URL returned by /v1/files — no
 * Figma API quota is consumed, no auth header needed. We treat it as a
 * free Vision input so even when /v1/images is rate-limited we still
 * have at least one screenshot to summarise from.
 */
export async function downloadFigmaThumbnailAsBase64(
  thumbnailUrl: string,
): Promise<RenderedImage | null> {
  try {
    return await downloadPng(thumbnailUrl);
  } catch (err) {
    console.warn("[figma-render] thumbnail download failed", err);
    return null;
  }
}

export async function renderFigmaFramesAsBase64(
  fileKey: string,
  nodeIds: string[],
): Promise<RenderedImage[]> {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token || nodeIds.length === 0) return [];
  // Render sequentially (not Promise.allSettled) — Figma rate-limits
  // /v1/images per-token aggressively. Firing 4 in parallel triggers
  // 429s on the later requests; serialising them takes 1–2 extra
  // seconds and keeps the whole batch successful.
  const out: RenderedImage[] = [];
  for (const id of nodeIds) {
    try {
      const img = await renderAndDownloadOne(token, fileKey, id);
      out.push(img);
    } catch (err) {
      console.warn("[figma-render] frame failed", {
        nodeId: id,
        err: (err as Error).message,
      });
    }
  }
  return out;
}

async function renderAndDownloadOne(
  token: string,
  fileKey: string,
  nodeId: string,
): Promise<RenderedImage> {
  // 1. Ask Figma to render this single frame. fetchWithRetryOn429
  //    handles transient rate limits — if Figma's quota was hit by a
  //    prior call in this batch, one short wait + retry usually
  //    succeeds.
  const renderRes = await fetchWithRetryOn429(
    `${FIGMA_API_BASE}/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=${RENDER_SCALE}`,
    {
      headers: { "X-Figma-Token": token, accept: "application/json" },
    },
  );
  if (!renderRes.ok) {
    const body = await renderRes.text().catch(() => "");
    throw new Error(`render ${renderRes.status}: ${body.slice(0, 120)}`);
  }
  const renderData = (await renderRes.json().catch(() => null)) as {
    images?: Record<string, string | null>;
  } | null;
  const pngUrl = renderData?.images?.[nodeId];
  if (!pngUrl) throw new Error("no png url returned");
  // 2. Download the resulting PNG.
  return downloadPng(pngUrl);
}

async function downloadPng(url: string): Promise<RenderedImage> {
  const fetched = await safeFetch(url, { timeoutMs: DOWNLOAD_TIMEOUT_MS, maxBytes: MAX_IMAGE_BYTES, init: {
    headers: {
      // Figma always serves WebP regardless of Accept; we accept
      // anything and re-encode below.
      accept: "image/png,image/webp,image/jpeg,image/*;q=0.8",
    },
  } });
  if (!fetched.ok) throw new Error(`download ${fetched.reason}`);
  const res = fetched.response;
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("image too large");
  }
  // Normalise to PNG before sending to Gemini Vision.
  //
  // Why: Figma serves an extended WebP variant (VP8X container with an
  // alpha chunk). gemini-2.5-flash-lite rejects this with a 400
  // "Unable to process input image" — observed in production, even
  // though Google's docs list image/webp as supported. PNG is
  // universally accepted and the encode is fast (~10–50 ms for these
  // 800×480 thumbnails). Sharp is already a Next.js transitive dep
  // and pinned as a direct dep in package.json.
  const mime = sniffImageMime(buf);
  if (mime === "image/png") {
    return { mimeType: "image/png", base64: buf.toString("base64") };
  }
  const png = await sharp(buf, { limitInputPixels: 20_000_000 }).resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  if (png.length > MAX_IMAGE_BYTES) throw new Error("Image exceeds size limit");
  return { mimeType: "image/png", base64: png.toString("base64") };
}

// Detect the image format from the leading magic bytes. We trust the
// wire content over the Content-Type header because Cloudflare
// auto-conversion can lie. Gemini Vision needs the *true* type, so
// passing PNG-labeled WebP silently degrades the summary (or fails
// outright).
function sniffImageMime(buf: Buffer): GeminiImageMime {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "image/webp";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  // Fallback — assume PNG. Most callers that hit this are Figma's
  // /v1/images endpoint which always returns PNG.
  return "image/png";
}
