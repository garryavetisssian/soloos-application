// Read a hh.ru vacancy via its server-rendered social-share image.
//
// Why this exists: hh.ru aggressively blocks both static HTML scraping
// (returns a "please enable JavaScript" stub) and unauthenticated API
// access (403 forbidden). But every vacancy has a server-rendered
// preview PNG at https://thumbnail.hh.ru/vacancy/{id}.png that
// contains the full job content rendered for social sharing. We
// download that image and let Gemini Vision read it.
//
// Output: plain text in the same shape extractJobPage returns, so the
// rest of the job-research pipeline doesn't change.

import * as cheerio from "cheerio";
import {
  GEMINI_FALLBACK_MODEL,
  GEMINI_MODEL,
  getGemini,
  shouldRetryOnFallbackModel,
} from "@/lib/gemini/client";
import { safeFetch } from "@/lib/safe-fetch";
import { htmlToText } from "./jsonld";

const THUMB_TIMEOUT_MS = 15_000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const PAGE_TIMEOUT_MS = 12_000;
const MAX_PAGE_BYTES = 4 * 1024 * 1024;

// hh.ru is a SPA that serves a "please enable JavaScript" stub to bots, but
// the full vacancy is embedded in a <template id="HH-Lux-InitialState">
// hydration blob (entity-encoded JSON). Parsing that gives the complete
// description without the API (which 403s non-RU/datacenter IPs) or Vision.
// This is the primary hh.ru path; Vision on the thumbnail is the fallback.

interface HhVacancyView {
  name?: string;
  company?: { name?: string };
  employer?: { name?: string };
  area?: { name?: string };
  description?: string;
  compensation?: {
    from?: number;
    to?: number;
    currencyCode?: string;
    noCompensation?: unknown;
  } | null;
  keySkills?: { keySkill?: Array<{ stringValue?: string } | string> } | string[] | null;
  workExperience?: string;
}

function decodeHtmlEntities(s: string): string {
  // Reuse cheerio's parser to decode &quot; &lt; &amp; etc. in one pass.
  try {
    return cheerio.load(`<t>${s}</t>`)("t").text();
  } catch {
    return s;
  }
}

function composeHhText(vv: HhVacancyView, fallbackTitle: string): string {
  const title = (vv.name ?? "").trim() || fallbackTitle;
  const company = (vv.company?.name ?? vv.employer?.name ?? "").trim();
  const lines: string[] = [];
  if (title || company) {
    lines.push(`${title || "Role"}${company ? ` — ${company}` : ""}`);
  }
  if (vv.area?.name) lines.push(`Location: ${vv.area.name}`);
  const c = vv.compensation;
  if (c && !c.noCompensation && (c.from || c.to)) {
    const amount = [c.from, c.to].filter((n) => typeof n === "number").join("–");
    lines.push(`Salary: ${amount} ${c.currencyCode ?? ""}`.trim());
  }
  // keySkills shape varies; pull string values defensively.
  const ks = vv.keySkills;
  const skills: string[] = Array.isArray(ks)
    ? (ks as string[])
    : (ks?.keySkill ?? []).map((k) =>
        typeof k === "string" ? k : (k.stringValue ?? ""),
      );
  const skillStr = skills.filter(Boolean).join(", ");
  if (skillStr) lines.push(`Key skills: ${skillStr}`);

  const description = htmlToText(vv.description ?? "");
  return [lines.join("\n"), description].filter(Boolean).join("\n\n").trim();
}

/**
 * Fetch a hh.ru vacancy page and parse its embedded hydration state for the
 * full vacancy text. Works without the (IP-blocked) API or Vision.
 */
export async function fetchHhVacancyFromHtml(rawUrl: string): Promise<HhResult> {
  const id = parseHhVacancyId(rawUrl);
  if (!id) return { ok: false, reason: "invalid_url" };
  const res = await safeFetch(rawUrl, {
    timeoutMs: PAGE_TIMEOUT_MS,
    maxBytes: MAX_PAGE_BYTES,
    init: {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "ru,en;q=0.9",
      },
    },
  });
  if (!res.ok || !res.response.ok) return { ok: false, reason: "thumb_unavailable" };
  let html: string;
  try {
    html = await res.response.text();
  } catch {
    return { ok: false, reason: "thumb_unavailable" };
  }
  const m = html.match(
    /<template[^>]*id="HH-Lux-InitialState"[^>]*>([\s\S]*?)<\/template>/,
  );
  if (!m) return { ok: false, reason: "vision_failed" };
  let state: { vacancyView?: HhVacancyView };
  try {
    state = JSON.parse(decodeHtmlEntities(m[1]));
  } catch {
    return { ok: false, reason: "vision_failed" };
  }
  const vv = state.vacancyView;
  if (!vv || (!vv.name && !vv.description)) {
    return { ok: false, reason: "vision_failed" };
  }
  const company = (vv.company?.name ?? vv.employer?.name ?? "").trim();
  return {
    ok: true,
    url: rawUrl,
    title: (vv.name ?? "").trim() || company || "hh.ru vacancy",
    metaDescription: company,
    text: composeHhText(vv, "Vacancy"),
  };
}

/**
 * Parse the numeric vacancy ID out of an hh.ru URL.
 * Accepts hh.ru, hh.kz, and other regional hh.* domains.
 *  - https://hh.ru/vacancy/133014384
 *  - https://hh.ru/vacancy/133014384?hhtmFrom=vacancy
 *  - https://moscow.hh.ru/vacancy/133014384
 */
export function parseHhVacancyId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (!/(^|\.)hh\.(ru|kz|by|am|kg|uz)$/.test(u.hostname)) return null;
    const m = u.pathname.match(/\/vacancy\/(\d+)\b/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function isHhUrl(rawUrl: string): boolean {
  return parseHhVacancyId(rawUrl) !== null;
}

export interface HhExtraction {
  ok: true;
  url: string;
  title: string;
  metaDescription: string;
  text: string;
}

export interface HhExtractionError {
  ok: false;
  reason: "invalid_url" | "thumb_unavailable" | "vision_failed";
}

export type HhResult = HhExtraction | HhExtractionError;

/**
 * Fetch the hh.ru server-rendered vacancy thumbnail and ask Gemini
 * Vision to transcribe + structure it as a job description.
 */
export async function fetchHhVacancy(rawUrl: string): Promise<HhResult> {
  const id = parseHhVacancyId(rawUrl);
  if (!id) return { ok: false, reason: "invalid_url" };

  // 1. Download the social-share PNG.
  let buf: Buffer;
  try {
    const res = await fetch(
      `https://thumbnail.hh.ru/vacancy/${id}.png?host=hh.ru`,
      {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko)",
          accept: "image/png,image/*",
        },
        signal: AbortSignal.timeout(THUMB_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      return { ok: false, reason: "thumb_unavailable" };
    }
    buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_IMAGE_BYTES) {
      return { ok: false, reason: "thumb_unavailable" };
    }
  } catch {
    return { ok: false, reason: "thumb_unavailable" };
  }

  const base64 = buf.toString("base64");

  // 2. Vision pass. We ask Gemini to read everything visible on the
  //    thumbnail and reproduce it as a structured plaintext job
  //    description we can pipe into the regular job-research path.
  const prompt = `The attached PNG is a server-rendered preview of a job vacancy from hh.ru. Read every visible piece of text — title, company name, salary, location, employment type, requirements, description text — and reproduce it as a plain-text job description suitable for AI summarisation.

Output ONLY a JSON object — no preamble, no markdown — with these keys:
- "title": the job title visible on the image (string, may be empty).
- "company": company name visible on the image (string, may be empty).
- "description": ONE plain-text block containing the rest of the vacancy content as it appears on the image. Preserve order. Keep the original language verbatim (Russian / English). Do NOT translate. Do NOT add explanatory commentary. Drop only obvious chrome ("hh.ru", "ОТКЛИКНУТЬСЯ" buttons, page numbers).`;

  const tryVision = async (modelName: string): Promise<string> => {
    const model = getGemini().getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: "image/png", data: base64 } },
    ]);
    return result.response.text();
  };

  let raw: string;
  try {
    raw = await tryVision(GEMINI_MODEL);
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (!shouldRetryOnFallbackModel(e)) {
      console.error("[hh-ru] vision error", err);
      return { ok: false, reason: "vision_failed" };
    }
    try {
      raw = await tryVision(GEMINI_FALLBACK_MODEL);
    } catch (err2) {
      console.error("[hh-ru] vision fallback error", err2);
      return { ok: false, reason: "vision_failed" };
    }
  }

  // Parse + assemble into the extract-success shape the rest of the
  // pipeline expects.
  try {
    const parsed = JSON.parse(raw) as {
      title?: unknown;
      company?: unknown;
      description?: unknown;
    };
    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    const company =
      typeof parsed.company === "string" ? parsed.company.trim() : "";
    const description =
      typeof parsed.description === "string"
        ? parsed.description.trim()
        : "";
    if (!title && !description) {
      return { ok: false, reason: "vision_failed" };
    }
    // Compose the text block downstream prompts will read. Keep the
    // hh.ru source URL visible so the cover-letter prompt has it for
    // employer-context detection.
    const composedTextParts: string[] = [];
    if (title || company) {
      composedTextParts.push(
        `${title || "Role"}${company ? ` — ${company}` : ""}`,
      );
    }
    if (description) composedTextParts.push(description);
    const composedText = composedTextParts.join("\n\n");
    return {
      ok: true,
      url: rawUrl,
      title: title || company || "hh.ru vacancy",
      metaDescription: company,
      text: composedText,
    };
  } catch (err) {
    console.error("[hh-ru] JSON parse error", err);
    return { ok: false, reason: "vision_failed" };
  }
}
