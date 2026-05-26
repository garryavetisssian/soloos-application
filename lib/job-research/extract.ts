// Job extraction orchestrator. One entry point the route calls; tries the
// strategies in order of quality/reliability:
//
//   1. Platform adapter (public JSON APIs: hh.ru, Greenhouse, Lever, …)
//   2. Generic page read: JSON-LD JobPosting (preferred) or cleaned body text
//   3. Vision fallback: transcribe the page's og:image when the body is a
//      JS-only shell / "enable JavaScript" stub
//
// All strategies return the same ExtractResult shape, so downstream (the
// Gemini structured prompt) is unaware of which path produced the text.

import { extractJobPage, type ExtractResult } from "@/lib/html-extract";
import { safeFetch } from "@/lib/safe-fetch";
import { findAdapter } from "./adapters";
import { transcribeJobImage, transcriptToText } from "./vision";

const IMAGE_TIMEOUT_MS = 15_000;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const MIN_USEFUL_TEXT_CHARS = 120;

// Download a preview image and let Gemini Vision transcribe it into text.
async function visionFromImageUrl(
  imageUrl: string,
  pageUrl: string,
): Promise<ExtractResult | null> {
  let absolute: string;
  try {
    absolute = new URL(imageUrl, pageUrl).toString();
  } catch {
    return null;
  }
  const res = await safeFetch(absolute, {
    timeoutMs: IMAGE_TIMEOUT_MS,
    maxBytes: IMAGE_MAX_BYTES,
    init: {
      headers: {
        accept: "image/*",
        "user-agent": "Mozilla/5.0 (compatible; SoloOSBot/1.0)",
      },
    },
  });
  if (!res.ok || !res.response.ok) return null;
  const mime = res.response.headers.get("content-type") || "image/png";
  if (!mime.startsWith("image/")) return null;
  let buf: Buffer;
  try {
    buf = Buffer.from(await res.response.arrayBuffer());
  } catch {
    return null;
  }
  if (buf.byteLength === 0 || buf.byteLength > IMAGE_MAX_BYTES) return null;

  const transcript = await transcribeJobImage(buf, mime.split(";")[0].trim());
  if (!transcript) return null;
  const text = transcriptToText(transcript);
  if (text.length < MIN_USEFUL_TEXT_CHARS) return null;
  return {
    ok: true,
    url: pageUrl,
    title: transcript.title || transcript.company || "Job posting",
    metaDescription: transcript.company,
    text,
    source: "body",
  };
}

export async function extractJob(rawUrl: string): Promise<ExtractResult> {
  // 1. Platform adapter (best quality when available).
  const adapter = findAdapter(rawUrl);
  if (adapter) {
    try {
      const url = new URL(rawUrl);
      const adapted = await adapter.extract(url);
      if (adapted.ok) return adapted;
    } catch (err) {
      console.warn("[extract] adapter threw, falling through", {
        adapter: adapter.name,
        err: (err as Error).message,
      });
    }
    // Adapter didn't produce content — fall through to the generic path.
  }

  // 2. Generic page read (JSON-LD preferred, else cleaned body text).
  const generic = await extractJobPage(rawUrl);
  if (generic.ok) return generic;

  // 3. Vision fallback on the preview image for JS-only / stub pages.
  if (
    (generic.reason === "js_required" || generic.reason === "low_content") &&
    generic.ogImage
  ) {
    const vision = await visionFromImageUrl(generic.ogImage, rawUrl);
    if (vision) return vision;
  }

  return generic;
}
