import { z } from "zod";
import type { UserProfile } from "@/lib/types";
import { parseLanguages } from "@/lib/profile-form";

const short = z.string().trim().max(300);
const text = z.string().max(10000);
const webUrl = z.string().trim().max(2000).refine(value => {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}, "Use an http or https URL");
export const CvDocument = z.object({
  version: z.literal(1), title: short.min(1), language: z.enum(["en", "ru", "hy"]),
  full_name: short, position: short, email: z.string().trim().max(300).refine(v => !v || z.string().email().safeParse(v).success),
  phone: short, location: short, linkedin_url: webUrl, portfolio_url: webUrl,
  summary: text, experience: text, education: text, skills: text, projects: text, languages: text,
}).strict();
export type CvDocument = z.infer<typeof CvDocument>;
export type CvRecord = { id: string; created_at: string; document: CvDocument };
export function blankCv(profile?: Partial<UserProfile> | null): CvDocument {
  return { version: 1, title: profile?.target_role || profile?.current_role || "My CV", language: profile?.preferred_language || "en", full_name: profile?.full_name || "", position: profile?.target_role || profile?.current_role || "", email: profile?.email || "", phone: "", location: profile?.location || "", linkedin_url: profile?.linkedin_url || "", portfolio_url: profile?.portfolio_url || "", summary: profile?.professional_summary || "", experience: "", education: "", skills: [profile?.skills, profile?.tools].filter(Boolean).join("\n"), projects: "", languages: parseLanguages(profile?.languages).map(l => l.level === "Unknown" ? l.name : `${l.name} (${l.level})`).join(", ") };
}
export function decodeCv(row: { id: string; title: string; summary: string | null; language: string; created_at: string }): CvRecord {
  let document = blankCv();
  try { const parsed = CvDocument.safeParse(JSON.parse(row.summary || "")); if (parsed.success) document = parsed.data; else document.summary = row.summary || ""; }
  catch { document.summary = row.summary || ""; }
  document.title = row.title;
  if (["en", "ru", "hy"].includes(row.language)) document.language = row.language as CvDocument["language"];
  return { id: row.id, created_at: row.created_at, document };
}
export const JOB_STATES = ["saved", "applied", "interview", "offer", "rejected"] as const;
const date = z.string().refine(v => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v), "Invalid date");
export const Application = z.object({ company: short.min(1), position: short.min(1), link: webUrl, status: z.enum(JOB_STATES), notes: text, follow_up: date, letter_id: z.union([z.literal(""), z.string().uuid()]) }).strict();
export type Application = z.infer<typeof Application>;
export type ApplicationRecord = Application & { id: string; created_at: string };
export const blankApplication = (): Application => ({ company: "", position: "", link: "", status: "saved", notes: "", follow_up: "", letter_id: "" });
const JobMeta = z.object({ version: z.literal(1), notes: text, follow_up: date, letter_id: z.union([z.literal(""), z.string().uuid()]) });
export function encodeJobNotes(job: Application): string { return JSON.stringify({ version: 1, notes: job.notes, follow_up: job.follow_up, letter_id: job.letter_id }); }
export function decodeApplication(row: { id: string; company: string; position: string; link: string | null; status: Application["status"]; notes: string | null; created_at: string }): ApplicationRecord {
  let meta = { notes: row.notes || "", follow_up: "", letter_id: "" };
  try { const parsed = JobMeta.safeParse(JSON.parse(row.notes || "")); if (parsed.success) meta = parsed.data; } catch { /* Legacy plain-text notes remain readable. */ }
  // Never render legacy unsafe links as anchors.
  const link = webUrl.safeParse(row.link || "");
  return { id: row.id, created_at: row.created_at, company: row.company, position: row.position, link: link.success ? link.data : "", status: row.status, notes: meta.notes, follow_up: meta.follow_up, letter_id: meta.letter_id };
}
