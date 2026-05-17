import { CompletenessBar } from "@/components/profile/completeness-bar";
import { CvStatusIndicator, type CvStatus } from "./cv-status-indicator";
import { MissingFieldsList } from "./missing-fields-list";
import { COVER_LETTER_MIN_COMPLETENESS } from "@/lib/profile-form";

interface Props {
  cvStatus: CvStatus;
  cvFilename?: string;
  completeness: number;
  guidance: string;
  missingFields: string[];
  // Optional contextual action (rendered below the missing-fields list).
  actionLabel?: string;
  actionHint?: string;
}

export function ProfileAssistantPanel({
  cvStatus,
  cvFilename,
  completeness,
  guidance,
  missingFields,
  actionLabel,
  actionHint,
}: Props) {
  return (
    <div className="space-y-7">
      <header>
        <div className="text-small uppercase tracking-wide text-muted-foreground">
          Profile assistant
        </div>
        <div className="pt-1 text-h3">SoloOS guide</div>
      </header>

      <Section title="CV status">
        <CvStatusIndicator status={cvStatus} filename={cvFilename} />
      </Section>

      <Section title="Profile completeness">
        <CompletenessBar
          value={completeness}
          threshold={COVER_LETTER_MIN_COMPLETENESS}
        />
        <p className="pt-2 text-small text-muted-foreground">
          Workspace unlocks at {COVER_LETTER_MIN_COMPLETENESS}%.
        </p>
      </Section>

      <Section title="What this step is for">
        <p className="text-small text-secondary-foreground">{guidance}</p>
      </Section>

      {missingFields.length > 0 && (
        <Section title="Missing required fields">
          <MissingFieldsList items={missingFields} />
        </Section>
      )}

      {actionLabel && (
        <Section title="Suggested next">
          <p className="text-small font-medium text-foreground">
            {actionLabel}
          </p>
          {actionHint && (
            <p className="pt-1 text-small text-muted-foreground">
              {actionHint}
            </p>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <div className="text-small uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </section>
  );
}
