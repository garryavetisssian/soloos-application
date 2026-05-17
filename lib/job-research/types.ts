// Structured job-page research returned by /api/ai/job-research and consumed
// by /api/ai/cover-letter. The shape is stable so the cover-letter prompt can
// rely on it without defensive checks.

import type { OutputLanguage } from "@/lib/i18n/types";

export interface JobResearch {
  url: string;
  is_job_page: boolean;
  company_name: string;
  job_title: string;
  job_summary: string;
  responsibilities: string;
  requirements: string;
  company_context: string;
  product_context: string;
  tone: string;
  useful_signals: string[];
  // Best-effort recruiter / hiring contact name pulled from the page when
  // it's clearly visible ("Posted by …", "Contact: …", a signature on
  // the job ad). Empty string when the page doesn't expose a name. Used
  // by the cover-letter generator when the user picks the "Direct
  // message" channel — preserved verbatim across translations.
  recruiter_name: string;
  // First few hundred chars of the cleaned page text — for the optional
  // "Show original" disclosure on the UI. This is always in the page's
  // source language regardless of normalization.
  raw_excerpt: string;
  // Language metadata. `source_language` is detected from the raw page text
  // before normalization; `output_language` is the language all
  // user-facing string fields above are rendered in. They differ when the
  // page was translated/normalized into the user's selected output language.
  source_language: OutputLanguage;
  output_language: OutputLanguage;
}
