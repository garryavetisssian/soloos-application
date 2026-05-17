import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Languages,
  PencilLine,
  Target,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileFormState } from "@/lib/profile-form";

interface Tip {
  id: string;
  title: string;
  text: string;
  actionLabel: string;
  icon: React.ReactNode;
  variant: "suggest" | "info";
}

// All tips currently route to /settings/profile. If this branches per tip
// later (e.g. deep-link with a section anchor), swap in a per-tip href and
// type it as `Route` from "next".
const TIP_HREF = "/settings/profile" as const;

// Threshold under which we suggest improving the summary. The validation
// limit is 1400 chars; below 100 chars likely won't add much signal to AI
// generation.
const WEAK_SUMMARY_BELOW = 100;
const SKILLS_TARGET = 5;

function computeTips(p: ProfileFormState): Tip[] {
  const tips: Tip[] = [];

  // Portfolio: suggest add when missing, otherwise show "connected" so the
  // user understands their URL is referenced (without faking analysis).
  if (!p.portfolio_url.trim()) {
    tips.push({
      id: "portfolio_missing",
      title: "Add your portfolio",
      text: "SoloOS can use your portfolio to understand your projects and make cover letters more specific.",
      actionLabel: "Add portfolio",
      icon: <Briefcase className="h-4 w-4" />,
      variant: "suggest",
    });
  } else {
    tips.push({
      id: "portfolio_connected",
      title: "Portfolio connected",
      text: "Project analysis is coming soon. For now, SoloOS will reference your portfolio link when relevant.",
      actionLabel: "View profile",
      icon: <Briefcase className="h-4 w-4" />,
      variant: "info",
    });
  }

  if (p.professional_summary.trim().length < WEAK_SUMMARY_BELOW) {
    tips.push({
      id: "summary_weak",
      title: "Improve your professional summary",
      text: "A stronger summary helps SoloOS position you more clearly for each role.",
      actionLabel: "Improve summary",
      icon: <PencilLine className="h-4 w-4" />,
      variant: "suggest",
    });
  }

  if (p.skills.length < SKILLS_TARGET) {
    tips.push({
      id: "skills_thin",
      title: "Add more skills",
      text: "More skills help SoloOS match your profile with job requirements more accurately.",
      actionLabel: "Add skills",
      icon: <Wrench className="h-4 w-4" />,
      variant: "suggest",
    });
  }

  if (p.tools.length === 0) {
    tips.push({
      id: "tools_missing",
      title: "Add your tools",
      text: "Tools like Figma, Notion, Linear, Webflow, or analytics platforms help tailor the letter.",
      actionLabel: "Add tools",
      icon: <Wrench className="h-4 w-4" />,
      variant: "suggest",
    });
  }

  if (p.languages.length === 0) {
    tips.push({
      id: "languages_missing",
      title: "Add languages",
      text: "Language information helps SoloOS adapt applications for international roles.",
      actionLabel: "Add languages",
      icon: <Languages className="h-4 w-4" />,
      variant: "suggest",
    });
  }

  if (p.target_industries.length === 0) {
    tips.push({
      id: "industries_missing",
      title: "Add target industries",
      text: "Target industries help SoloOS frame your experience for the roles you actually want.",
      actionLabel: "Add industries",
      icon: <Target className="h-4 w-4" />,
      variant: "suggest",
    });
  }

  return tips;
}

export function ProfileTips({ profile }: { profile: ProfileFormState }) {
  const tips = computeTips(profile);
  if (tips.length === 0) return null;

  return (
    <section
      aria-label="AI-readiness suggestions"
      className="-mx-1 overflow-x-auto pb-1"
    >
      <ul className="flex gap-3 px-1">
        {tips.map((tip) => (
          <li
            key={tip.id}
            className="min-w-[280px] max-w-[340px] flex-shrink-0 sm:min-w-[300px]"
          >
            <TipCard tip={tip} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function TipCard({ tip }: { tip: Tip }) {
  const isInfo = tip.variant === "info";
  return (
    <Link
      href={TIP_HREF}
      aria-label={`${tip.actionLabel} — ${tip.title}`}
      className={cn(
        "group flex h-full max-h-[88px] items-start gap-3 overflow-hidden rounded-2xl border p-3 transition-colors",
        isInfo
          ? "border-success/25 bg-success/5"
          : "border-border bg-surface hover:border-primary/40 hover:bg-surface-elevated",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          isInfo
            ? "bg-success/15 text-success"
            : "bg-surface-elevated text-foreground",
        )}
      >
        {tip.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-small font-medium text-foreground">
          {tip.title}
        </div>
        <p className="line-clamp-2 text-small text-muted-foreground">
          {tip.text}
        </p>
      </div>
      <ArrowRight
        className={cn(
          "mt-1.5 h-4 w-4 shrink-0 transition-colors",
          isInfo
            ? "text-success"
            : "text-muted-foreground group-hover:text-primary",
        )}
      />
    </Link>
  );
}
