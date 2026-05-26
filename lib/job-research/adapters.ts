// Per-platform job extraction adapters.
//
// Some platforms expose a clean public JSON API that beats scraping their
// HTML — we use it directly when we recognise the host. Adapters are tried
// before the generic JSON-LD / body-text pipeline. Each returns the same
// ExtractResult shape as extractJobPage so the orchestrator is uniform.
//
// Adding a platform = add an adapter to the ADAPTERS array. Nothing else
// changes.

import { safeFetch } from "@/lib/safe-fetch";
import { htmlToText } from "./jsonld";
import {
  parseHhVacancyId,
  fetchHhVacancy,
  fetchHhVacancyFromHtml,
} from "./hh-ru";
import type { ExtractResult } from "@/lib/html-extract";

const API_TIMEOUT_MS = 10_000;
const API_MAX_BYTES = 3 * 1024 * 1024;

export interface JobAdapter {
  name: string;
  match(url: URL): boolean;
  extract(url: URL): Promise<ExtractResult>;
}

// Shared JSON GET through the SSRF-hardened fetcher. The host is always one
// we hardcode below; only path segments come from the user URL.
async function fetchJson<T>(
  apiUrl: string,
): Promise<{ ok: true; data: T } | { ok: false; status?: number }> {
  const res = await safeFetch(apiUrl, {
    timeoutMs: API_TIMEOUT_MS,
    maxBytes: API_MAX_BYTES,
    init: {
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 (compatible; SoloOSBot/1.0)",
      },
    },
  });
  if (!res.ok) return { ok: false };
  if (!res.response.ok) return { ok: false, status: res.response.status };
  try {
    return { ok: true, data: (await res.response.json()) as T };
  } catch {
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// hh.ru — parse the page's embedded hydration JSON (full description), with
// a Vision-on-thumbnail fallback. The official api.hh.ru returns 403 to
// non-RU / datacenter IPs, so we don't rely on it.
// ---------------------------------------------------------------------------
const hhAdapter: JobAdapter = {
  name: "hh.ru",
  match: (url) => parseHhVacancyId(url.toString()) !== null,
  async extract(url) {
    const fromHtml = await fetchHhVacancyFromHtml(url.toString());
    if (fromHtml.ok) {
      return {
        ok: true,
        url: fromHtml.url,
        title: fromHtml.title,
        metaDescription: fromHtml.metaDescription,
        text: fromHtml.text,
      };
    }
    // Fall back to Vision on the server-rendered social thumbnail.
    const vis = await fetchHhVacancy(url.toString());
    if (vis.ok) {
      return {
        ok: true,
        url: vis.url,
        title: vis.title,
        metaDescription: vis.metaDescription,
        text: vis.text,
      };
    }
    return { ok: false, reason: "fetch_failed", detail: "hh html+vision" };
  },
};

// ---------------------------------------------------------------------------
// Greenhouse — public board API.
// https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}
// URLs: boards.greenhouse.io/{board}/jobs/{id}, job-boards.greenhouse.io/...
// ---------------------------------------------------------------------------
interface GreenhouseJob {
  title?: string;
  content?: string; // HTML-entity-escaped HTML
  location?: { name?: string };
  company_name?: string;
}

const greenhouseAdapter: JobAdapter = {
  name: "greenhouse",
  match: (url) => /(^|\.)greenhouse\.io$/.test(url.hostname),
  async extract(url) {
    const m = url.pathname.match(/\/([^/]+)\/jobs\/(\d+)/);
    if (!m) return { ok: false, reason: "invalid_url" };
    const [, board, id] = m;
    const r = await fetchJson<GreenhouseJob>(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${id}`,
    );
    if (!r.ok) return { ok: false, reason: "fetch_failed", detail: "greenhouse api" };
    const j = r.data;
    const title = (j.title ?? "").trim();
    // content is HTML-entity-escaped HTML; htmlToText (cheerio) decodes it.
    const description = htmlToText(j.content ?? "");
    if (!title && !description) return { ok: false, reason: "low_content" };
    const header: string[] = [];
    if (title || j.company_name) {
      header.push(`${title || "Role"}${j.company_name ? ` — ${j.company_name}` : ""}`);
    }
    if (j.location?.name) header.push(`Location: ${j.location.name}`);
    const text = [header.join("\n"), description].filter(Boolean).join("\n\n");
    return {
      ok: true,
      url: url.toString(),
      title: title || "Role",
      metaDescription: j.company_name ?? "",
      text,
    };
  },
};

// ---------------------------------------------------------------------------
// Lever — public postings API.
// https://api.lever.co/v0/postings/{site}/{id}?mode=json
// URLs: jobs.lever.co/{site}/{id}
// ---------------------------------------------------------------------------
interface LeverPosting {
  text?: string; // title
  descriptionPlain?: string;
  additionalPlain?: string;
  categories?: { location?: string; team?: string; commitment?: string };
  lists?: Array<{ text?: string; content?: string }>;
}

const leverAdapter: JobAdapter = {
  name: "lever",
  match: (url) => /(^|\.)lever\.co$/.test(url.hostname),
  async extract(url) {
    const m = url.pathname.match(/\/([^/]+)\/([0-9a-f-]{36}|[^/]+)/i);
    if (!m) return { ok: false, reason: "invalid_url" };
    const [, site, id] = m;
    const r = await fetchJson<LeverPosting>(
      `https://api.lever.co/v0/postings/${encodeURIComponent(site)}/${encodeURIComponent(id)}?mode=json`,
    );
    if (!r.ok) return { ok: false, reason: "fetch_failed", detail: "lever api" };
    const p = r.data;
    const title = (p.text ?? "").trim();
    const header: string[] = [];
    if (title) header.push(title);
    if (p.categories?.location) header.push(`Location: ${p.categories.location}`);
    if (p.categories?.commitment) header.push(`Employment: ${p.categories.commitment}`);
    if (p.categories?.team) header.push(`Team: ${p.categories.team}`);
    const listBlocks = (p.lists ?? [])
      .map((l) => `${l.text ? l.text + ":\n" : ""}${htmlToText(l.content ?? "")}`)
      .filter((s) => s.trim());
    const body = [
      p.descriptionPlain ?? "",
      ...listBlocks,
      p.additionalPlain ?? "",
    ]
      .filter((s) => s.trim())
      .join("\n\n");
    if (!title && !body) return { ok: false, reason: "low_content" };
    const text = [header.join("\n"), body].filter(Boolean).join("\n\n");
    return {
      ok: true,
      url: url.toString(),
      title: title || "Role",
      metaDescription: p.categories?.team ?? "",
      text,
    };
  },
};

const ADAPTERS: JobAdapter[] = [hhAdapter, greenhouseAdapter, leverAdapter];

/** Find a platform adapter for the URL, or null for the generic pipeline. */
export function findAdapter(rawUrl: string): JobAdapter | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  return ADAPTERS.find((a) => a.match(url)) ?? null;
}
