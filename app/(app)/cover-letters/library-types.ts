// Shared between the server library page and its client-side filter/grid.
// We deliberately keep this lean — the heavy job_research / job_description
// payload is only loaded on the detail page where it's needed.

export interface SavedLetterRow {
  id: string;
  content: string;
  job_title: string | null;
  company_name: string | null;
  language: "English" | "Russian" | "Armenian" | null;
  source_type: "manual" | "job_link" | null;
  source_url: string | null;
  created_at: string;
  updated_at: string | null;
}
