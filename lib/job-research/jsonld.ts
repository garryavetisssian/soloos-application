// Generic schema.org JobPosting extractor.
//
// Almost every serious job board embeds a <script type="application/ld+json">
// JobPosting block server-side, because Google Jobs requires it for indexing.
// That block carries the full structured posting (title, description HTML,
// hiring organization, location, salary) even on JS-rendered SPA pages whose
// visible body is an empty shell. Parsing it is the single most general way
// to read jobs across platforms (LinkedIn, Indeed, Glassdoor, Workday,
// Ashby, SmartRecruiters, …) without rendering JavaScript.

import * as cheerio from "cheerio";

export interface JobPostingLD {
  title: string;
  description: string; // plain text (HTML stripped)
  company: string;
  location: string;
  employmentType: string;
  salary: string;
  datePosted: string;
}

// Strip HTML to readable plain text. JobPosting.description is typically an
// HTML fragment; collapse it to text the Gemini structured prompt can read.
// Exported so platform adapters (which also receive HTML descriptions from
// their APIs) reuse the same normalization.
export function htmlToText(html: string): string {
  if (!html) return "";
  try {
    let s = html;
    // Some APIs (e.g. Greenhouse) return entity-escaped HTML (`&lt;p&gt;`).
    // Decode entities to real markup first so the strip pass below sees
    // actual tags rather than visible "<p>" text.
    if (/&lt;|&gt;/.test(s)) {
      s = cheerio.load(`<body>${s}</body>`)("body").text();
    }
    // Fast path: genuinely no tags.
    if (!/<[a-z!/]/i.test(s)) return s.replace(/\s+/g, " ").trim();
    const $ = cheerio.load(`<div>${s}</div>`);
    // Preserve list/paragraph breaks so requirements read as separate lines.
    $("li").each((_, el) => {
      $(el).prepend("• ");
    });
    $("br").replaceWith("\n");
    $("p, li, h1, h2, h3, h4, div").append("\n");
    const text = $("div").first().text();
    return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
}

function asString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
}

// Flatten the many shapes JSON-LD comes in: a single object, an array of
// objects, or a { "@graph": [...] } container.
function collectNodes(parsed: unknown, out: Record<string, unknown>[]): void {
  if (!parsed) return;
  if (Array.isArray(parsed)) {
    for (const item of parsed) collectNodes(item, out);
    return;
  }
  if (typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    out.push(obj);
    if (Array.isArray(obj["@graph"])) collectNodes(obj["@graph"], out);
  }
}

function isJobPosting(node: Record<string, unknown>): boolean {
  const t = node["@type"];
  if (typeof t === "string") return t.toLowerCase() === "jobposting";
  if (Array.isArray(t))
    return t.some((x) => String(x).toLowerCase() === "jobposting");
  return false;
}

function extractCompany(node: Record<string, unknown>): string {
  const org = node.hiringOrganization;
  if (typeof org === "string") return org.trim();
  if (org && typeof org === "object") {
    return asString((org as Record<string, unknown>).name);
  }
  return "";
}

function extractLocation(node: Record<string, unknown>): string {
  const loc = node.jobLocation;
  const one = Array.isArray(loc) ? loc[0] : loc;
  if (!one) {
    // Remote postings sometimes use applicantLocationRequirements instead.
    const alt = node.applicantLocationRequirements;
    const altOne = Array.isArray(alt) ? alt[0] : alt;
    if (altOne && typeof altOne === "object") {
      return asString((altOne as Record<string, unknown>).name);
    }
    return "";
  }
  if (typeof one === "string") return one.trim();
  const addr = (one as Record<string, unknown>).address;
  if (typeof addr === "string") return addr.trim();
  if (addr && typeof addr === "object") {
    const a = addr as Record<string, unknown>;
    return [a.addressLocality, a.addressRegion, a.addressCountry]
      .map(asString)
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

function extractSalary(node: Record<string, unknown>): string {
  const s = node.baseSalary;
  if (!s || typeof s !== "object") return "";
  const so = s as Record<string, unknown>;
  const currency = asString(so.currency);
  const value = so.value;
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    const min = asString(v.minValue);
    const max = asString(v.maxValue);
    const single = asString(v.value);
    const unit = asString(v.unitText);
    const amount = single || [min, max].filter(Boolean).join("–");
    if (!amount) return "";
    return [currency, amount, unit && `per ${unit.toLowerCase()}`]
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function extractEmploymentType(node: Record<string, unknown>): string {
  const t = node.employmentType;
  if (typeof t === "string") return t.trim();
  if (Array.isArray(t)) return t.map(asString).filter(Boolean).join(", ");
  return "";
}

/**
 * Parse the raw contents of every <script type="application/ld+json"> on a
 * page and return the first JobPosting found, normalized. Returns null when
 * no parseable JobPosting is present.
 */
export function parseJobPostingLd(scripts: string[]): JobPostingLD | null {
  const nodes: Record<string, unknown>[] = [];
  for (const raw of scripts) {
    if (!raw || !raw.trim()) continue;
    try {
      collectNodes(JSON.parse(raw), nodes);
    } catch {
      // Some sites concatenate multiple JSON objects or include trailing
      // commas; skip anything that doesn't parse cleanly.
    }
  }
  const posting = nodes.find(isJobPosting);
  if (!posting) return null;

  const description = htmlToText(asString(posting.description));
  const title = asString(posting.title);
  if (!title && !description) return null;

  return {
    title,
    description,
    company: extractCompany(posting),
    location: extractLocation(posting),
    employmentType: extractEmploymentType(posting),
    salary: extractSalary(posting),
    datePosted: asString(posting.datePosted).slice(0, 10),
  };
}

/**
 * Compose a JobPosting into the plain-text block the Gemini structured
 * prompt reads. Front-loads the key facts, then the full description.
 */
export function jobPostingToText(p: JobPostingLD): string {
  const header: string[] = [];
  if (p.title || p.company) {
    header.push(`${p.title || "Role"}${p.company ? ` — ${p.company}` : ""}`);
  }
  if (p.location) header.push(`Location: ${p.location}`);
  if (p.employmentType) header.push(`Employment type: ${p.employmentType}`);
  if (p.salary) header.push(`Salary: ${p.salary}`);
  const parts = [header.join("\n")];
  if (p.description) parts.push(p.description);
  return parts.join("\n\n").trim();
}
