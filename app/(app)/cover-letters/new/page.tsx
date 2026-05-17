import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getServerT } from "@/lib/i18n/server";
import { getCurrentProfile } from "@/lib/profile";
import { computeCompleteness, formStateFromRow } from "@/lib/profile-form";
import { CoverLetterForm } from "../cover-letter-form";
import { ProfileTips } from "../profile-tips";

export default async function NewCoverLetterPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const formState = formStateFromRow(profile);
  const completeness = computeCompleteness(formState);
  const { t } = await getServerT();

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col px-6 py-6 sm:px-8">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/cover-letters"
            className="inline-flex items-center gap-1.5 text-small text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("cover_letter.library.back_to_library")}
          </Link>
          <h1 className="mt-2 text-h1 tracking-tight">
            {t("cover_letter.generator.title")}
          </h1>
          <p className="pt-1 text-body text-secondary-foreground">
            {t("cover_letter.generator.subtitle")}
          </p>
        </div>
        <ProfileReadyBadge
          completeness={completeness}
          label={t("common.profile_ready.label")}
        />
      </header>

      <div className="shrink-0 py-4">
        <ProfileTips profile={formState} />
      </div>

      <CoverLetterForm completeness={completeness} />
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
    <div className="flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-small">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
      <span className="text-foreground">{label}</span>
      <span className="text-muted-foreground">·</span>
      <span className="tabular-nums text-secondary-foreground">
        {completeness}%
      </span>
    </div>
  );
}
