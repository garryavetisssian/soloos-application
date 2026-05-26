import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Languages,
  PencilLine,
  Target,
  Wrench,
} from "lucide-react";
import { getServerT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import type { ProfileFormState } from "@/lib/profile-form";

type T = (key: string, vars?: Record<string, string | number>) => string;

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

function computeTips(p: ProfileFormState, t: T): Tip[] {
  const tips: Tip[] = [];
  const tip = (
    id: string,
    icon: React.ReactNode,
    variant: Tip["variant"],
  ): Tip => ({
    id,
    title: t(`pages.profile_tips.${id}.title`),
    text: t(`pages.profile_tips.${id}.text`),
    actionLabel: t(`pages.profile_tips.${id}.action`),
    icon,
    variant,
  });

  // Portfolio: suggest add when missing, otherwise show "connected" so the
  // user understands their URL is referenced (without faking analysis).
  if (!p.portfolio_url.trim()) {
    tips.push(
      tip("portfolio_missing", <Briefcase className="h-4 w-4" />, "suggest"),
    );
  } else {
    tips.push(
      tip("portfolio_connected", <Briefcase className="h-4 w-4" />, "info"),
    );
  }

  if (p.professional_summary.trim().length < WEAK_SUMMARY_BELOW) {
    tips.push(tip("summary_weak", <PencilLine className="h-4 w-4" />, "suggest"));
  }

  if (p.skills.length < SKILLS_TARGET) {
    tips.push(tip("skills_thin", <Wrench className="h-4 w-4" />, "suggest"));
  }

  if (p.tools.length === 0) {
    tips.push(tip("tools_missing", <Wrench className="h-4 w-4" />, "suggest"));
  }

  if (p.languages.length === 0) {
    tips.push(
      tip("languages_missing", <Languages className="h-4 w-4" />, "suggest"),
    );
  }

  if (p.target_industries.length === 0) {
    tips.push(
      tip("industries_missing", <Target className="h-4 w-4" />, "suggest"),
    );
  }

  return tips;
}

export async function ProfileTips({
  profile,
}: {
  profile: ProfileFormState;
}) {
  const { t } = await getServerT();
  const tips = computeTips(profile, t);
  if (tips.length === 0) return null;

  return (
    <section
      aria-label={t("pages.profile_tips.section_label")}
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
        "group flex h-full max-h-[88px] items-start gap-3 overflow-hidden rounded-xl border p-3 shadow-sm transition-colors",
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
