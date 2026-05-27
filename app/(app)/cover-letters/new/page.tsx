import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getServerT } from "@/lib/i18n/server";
import { getCurrentProfile } from "@/lib/profile";
import { computeCompleteness, formStateFromRow } from "@/lib/profile-form";
import { createClient } from "@/lib/supabase/server";
import { loadEligibleCoverLetterLinks } from "@/lib/work-links/eligible";
import { CoverLetterForm, type SelectableLink } from "../cover-letter-form";
import { ProfileTips } from "../profile-tips";

const stripProtocol = (url: string) => url.replace(/^https?:\/\//, "");

export default async function NewCoverLetterPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const formState = formStateFromRow(profile);
  const completeness = computeCompleteness(formState);
  const { t } = await getServerT();

  // Links the user can pick from for the letter: their profile Portfolio
  // URL plus eligible (ready, enabled, quality-passing) project links.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const eligibleLinks = user
    ? await loadEligibleCoverLetterLinks(supabase, user.id)
    : [];
  const profileUrl = formState.portfolio_url.trim();
  const availableLinks: SelectableLink[] = [
    ...(profileUrl
      ? [{ url: profileUrl, label: stripProtocol(profileUrl), kind: "profile" as const }]
      : []),
    ...eligibleLinks.map((l) => ({
      url: l.url,
      label: l.title?.trim() || stripProtocol(l.url),
      kind: "work" as const,
    })),
  ];

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col px-6 py-10 sm:px-10">
      <header className="shrink-0 animate-fade-in">
        <Link
          href="/cover-letters"
          className="inline-flex items-center gap-1.5 text-small text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("cover_letter.library.back_to_library")}
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-h1 font-semibold tracking-[-0.02em] text-foreground">
            {t("cover_letter.generator.title")}
          </h1>
          <ProfileReadyBadge
            completeness={completeness}
            label={t("common.profile_ready.label")}
          />
        </div>
        <p className="mt-2 max-w-[64ch] text-body text-muted-foreground">
          {t("cover_letter.generator.subtitle")}
        </p>
      </header>

      <div className="shrink-0 py-6">
        <ProfileTips profile={formState} />
      </div>

      <CoverLetterForm
        completeness={completeness}
        availableLinks={availableLinks}
      />
    </div>
  );
}

function ProfileReadyBadge({
  completeness,
  label,
}: {
  completeness: number;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 shadow-xs">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
      <span className="text-small text-muted-foreground">{label}</span>
      <span className="text-small font-semibold tabular-nums text-foreground">
        {completeness}%
      </span>
    </div>
  );
}
