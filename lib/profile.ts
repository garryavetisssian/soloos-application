import { parseLanguages } from "@/lib/profile-form";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/lib/types";

function formatSalaryRange(p: UserProfile): string | null {
  if (p.salary_min == null && p.salary_max == null) return null;
  const currency = p.salary_currency ?? "USD";
  const period = p.salary_period ?? "monthly";
  if (p.salary_min != null && p.salary_max != null) {
    return `${currency} ${p.salary_min}-${p.salary_max} (${period})`;
  }
  if (p.salary_min != null) {
    return `${currency} from ${p.salary_min} (${period})`;
  }
  return `${currency} up to ${p.salary_max} (${period})`;
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (data as UserProfile | null) ?? null;
}

export function profileToCandidateContext(p: UserProfile): string {
  const lines: string[] = [];
  if (p.full_name) lines.push(`Name: ${p.full_name}`);
  if (p.current_role) lines.push(`Current role: ${p.current_role}`);
  if (p.years_of_experience)
    lines.push(`Years of experience: ${p.years_of_experience}`);
  if (p.location) lines.push(`Location: ${p.location}`);
  if (p.professional_summary) {
    lines.push("");
    lines.push(`Summary:\n${p.professional_summary}`);
  }
  if (p.skills) lines.push(`\nSkills: ${p.skills}`);
  if (p.tools) lines.push(`Tools: ${p.tools}`);
  const langs = parseLanguages(p.languages);
  if (langs.length > 0) {
    lines.push(
      `Spoken languages: ${langs.map((l) => `${l.name} (${l.level})`).join(", ")}`,
    );
  }
  if (p.target_role) lines.push(`\nTarget role: ${p.target_role}`);
  if (p.target_industries)
    lines.push(`Target industries: ${p.target_industries}`);
  if (p.preferred_work_format)
    lines.push(`Preferred work format: ${p.preferred_work_format}`);
  const salaryLabel = formatSalaryRange(p);
  if (salaryLabel) lines.push(`Salary expectation: ${salaryLabel}`);
  if (p.linkedin_url) lines.push(`\nLinkedIn: ${p.linkedin_url}`);
  if (p.portfolio_url) lines.push(`Portfolio: ${p.portfolio_url}`);
  return lines.join("\n");
}
