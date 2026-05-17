"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  FileUp,
  Loader2,
  PencilLine,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CharCounter } from "@/components/profile/char-counter";
import { FormField } from "@/components/profile/form-field";
import { LanguageEditor } from "@/components/profile/language-editor";
import { SalaryInput } from "@/components/profile/salary-input";
import { TagInput } from "@/components/profile/tag-input";
import { FormSection } from "@/components/onboarding/form-section";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { ProductNavPreview } from "@/components/onboarding/product-nav-preview";
import { ProfileAssistantPanel } from "@/components/onboarding/profile-assistant-panel";
import {
  StepNavigation,
  type StepStatus,
} from "@/components/onboarding/step-navigation";
import {
  UploadCVCard,
  type UploadState,
} from "@/components/onboarding/upload-cv-card";
import type { CvStatus } from "@/components/onboarding/cv-status-indicator";
import { STEPS, stepById } from "@/lib/onboarding-content";
import {
  COVER_LETTER_MIN_COMPLETENESS,
  EMPTY_PROFILE_FORM,
  computeCompleteness,
  firstIncompleteStep,
  parseTags,
  serializeTags,
  validateProfile,
  type OnboardingStep,
  type ProfileFieldErrors,
  type ProfileFormState,
} from "@/lib/profile-form";
import {
  type Language,
  type LanguageEntry,
} from "@/lib/types";
import type { DetectedLink } from "@/lib/cv-link-classify";
import { cn } from "@/lib/utils";
import { saveProfileAction } from "./actions";

type Screen =
  | { kind: "decide" }
  | { kind: "import_upload" }
  | { kind: "import_review" }
  | { kind: "manual"; step: OnboardingStep };

const SUMMARY_MAX = 1400;

interface Props {
  defaultEmail?: string;
  // When the user has a partial profile already saved, we hydrate the form
  // and resume into manual mode at the first incomplete step.
  initial?: ProfileFormState;
}

export function OnboardingFlow({ defaultEmail, initial }: Props) {
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>(
    initial
      ? { kind: "manual", step: firstIncompleteStep(initial) }
      : { kind: "decide" },
  );
  const [data, setData] = useState<ProfileFormState>(
    initial ?? { ...EMPTY_PROFILE_FORM, email: defaultEmail ?? "" },
  );
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [topError, setTopError] = useState<string | null>(null);

  const [uploadState, setUploadState] = useState<UploadState>({ kind: "empty" });
  const [cvAnalyzed, setCvAnalyzed] = useState(false);
  const [detectedLinks, setDetectedLinks] = useState<DetectedLink[]>([]);

  const [summarizing, setSummarizing] = useState(false);
  const [saving, startSaving] = useTransition();

  function update<K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K],
  ) {
    setData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  // ---------- Screen transitions ----------

  function go(next: Screen) {
    setTopError(null);
    setErrors({});
    setScreen(next);
  }
  function chooseImport() {
    go({ kind: "import_upload" });
  }
  function chooseManual() {
    go({ kind: "manual", step: 1 });
  }
  function manualAt(step: OnboardingStep) {
    go({ kind: "manual", step });
  }
  function helperUploadCv() {
    go({ kind: "import_upload" });
  }

  function manualNext() {
    if (screen.kind !== "manual") return;
    const stepErrors = validateStep(screen.step, data);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      setTopError("Fix the highlighted fields to continue.");
      return;
    }
    go({
      kind: "manual",
      step: Math.min(screen.step + 1, 6) as OnboardingStep,
    });
  }
  function manualBack() {
    if (screen.kind !== "manual") return;
    if (screen.step === 1) {
      go({ kind: "decide" });
      return;
    }
    go({
      kind: "manual",
      step: Math.max(screen.step - 1, 1) as OnboardingStep,
    });
  }

  // ---------- CV upload + AI extraction ----------

  function handleFile(file: File) {
    setTopError(null);
    setUploadState({ kind: "selected", file });
  }
  function handleClearFile() {
    setUploadState({ kind: "empty" });
    setDetectedLinks([]);
  }

  async function handleAnalyze() {
    if (uploadState.kind !== "selected") return;
    const file = uploadState.file;
    setUploadState({ kind: "analyzing", file });
    setTopError(null);
    setDetectedLinks([]);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ai/profile-enhance", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json().catch(() => ({}))) as {
        full_name?: string;
        current_role?: string;
        location?: string;
        email?: string;
        linkedin_url?: string;
        portfolio_url?: string;
        years_of_experience?: string;
        professional_summary?: string;
        skills?: string;
        tools?: string;
        languages?: LanguageEntry[];
        target_role?: string;
        target_industries?: string;
        detected_links?: DetectedLink[];
        message?: string;
        subtext?: string;
      };
      if (!res.ok) {
        setUploadState({
          kind: "error",
          file,
          message:
            json.message ?? "We couldn't extract information from this CV.",
          subtext:
            json.subtext ??
            "Try another file, or skip ahead and fill the profile manually.",
        });
        return;
      }
      setData((prev) => ({
        ...prev,
        full_name: json.full_name || prev.full_name,
        current_role: json.current_role || prev.current_role,
        location: json.location || prev.location,
        email: json.email || prev.email,
        linkedin_url: json.linkedin_url || prev.linkedin_url,
        portfolio_url: json.portfolio_url || prev.portfolio_url,
        years_of_experience:
          json.years_of_experience || prev.years_of_experience,
        professional_summary:
          json.professional_summary || prev.professional_summary,
        skills:
          json.skills && json.skills.length > 0
            ? mergeUnique(prev.skills, parseTags(json.skills))
            : prev.skills,
        tools:
          json.tools && json.tools.length > 0
            ? mergeUnique(prev.tools, parseTags(json.tools))
            : prev.tools,
        languages:
          json.languages && json.languages.length > 0
            ? json.languages
            : prev.languages,
        target_role: json.target_role || prev.target_role,
        target_industries:
          json.target_industries && json.target_industries.length > 0
            ? mergeUnique(
                prev.target_industries,
                parseTags(json.target_industries),
              )
            : prev.target_industries,
      }));
      setUploadState({ kind: "selected", file });
      setCvAnalyzed(true);
      setDetectedLinks(json.detected_links ?? []);
      go({ kind: "import_review" });
    } catch (err) {
      setUploadState({
        kind: "error",
        file,
        message: "We couldn't extract information from this CV.",
        subtext:
          err instanceof Error
            ? `Network error: ${err.message}`
            : "Try another file, or skip ahead and fill the profile manually.",
      });
    }
  }

  // ---------- AI summary ----------

  async function generateSummary() {
    if (summarizing) return;
    setSummarizing(true);
    setTopError(null);
    try {
      const res = await fetch("/api/ai/profile-summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          current_role: data.current_role,
          years_of_experience: data.years_of_experience,
          skills: serializeTags(data.skills),
          tools: serializeTags(data.tools),
          target_role: data.target_role,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        summary?: string;
        message?: string;
      };
      if (!res.ok) {
        setTopError(json.message ?? "Could not generate a summary.");
        return;
      }
      update(
        "professional_summary",
        (json.summary ?? "").slice(0, SUMMARY_MAX),
      );
    } catch (err) {
      setTopError(
        err instanceof Error
          ? `Network error: ${err.message}`
          : "Network error.",
      );
    } finally {
      setSummarizing(false);
    }
  }

  // ---------- Save ----------

  function saveAndDecide(onLowCompleteness: () => void) {
    const all = validateProfile(data);
    if (Object.keys(all).length > 0) {
      // Don't navigate away on validation fail — the missing-fields action
      // panel and inline row highlights make it obvious what's missing.
      setErrors(all);
      setTopError(null);
      return;
    }
    setTopError(null);
    startSaving(async () => {
      const result = await saveProfileAction(data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setTopError(result.error);
        return;
      }
      if (result.completeness < COVER_LETTER_MIN_COMPLETENESS) {
        onLowCompleteness();
        setTopError(
          `Profile saved at ${result.completeness}%. Reach ${COVER_LETTER_MIN_COMPLETENESS}% to unlock the workspace.`,
        );
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    });
  }

  // From the import:review screen, fall through into manual at the first
  // incomplete step when below the threshold.
  function handleImportReviewSave() {
    saveAndDecide(() => {
      go({ kind: "manual", step: firstIncompleteStep(data) });
    });
  }
  // From manual:6 review, just stay where we are with the inline message.
  function handleManualSave() {
    saveAndDecide(() => {
      // Keep them on review to fill more fields in place.
    });
  }

  // ---------- Derived state ----------

  const allErrors = useMemo(() => validateProfile(data), [data]);
  const completeness = useMemo(() => computeCompleteness(data), [data]);
  const missing = useMemo(() => missingFieldsList(allErrors), [allErrors]);

  const cvStatus: CvStatus = computeCvStatus(uploadState, cvAnalyzed, screen);
  const cvFilename =
    uploadState.kind === "selected" || uploadState.kind === "analyzing"
      ? uploadState.file.name
      : uploadState.kind === "error" && uploadState.file
        ? uploadState.file.name
        : undefined;

  const currentStep =
    screen.kind === "manual" ? screen.step : null;
  const statuses: Record<OnboardingStep, StepStatus> = useMemo(() => {
    const result = {} as Record<OnboardingStep, StepStatus>;
    for (const s of STEPS) {
      result[s.id] = computeStepStatus(s.id, currentStep, allErrors);
    }
    return result;
  }, [currentStep, allErrors]);

  const guidance = computeGuidance(screen);
  const assistantAction = computeAssistantAction({
    screen,
    cvStatus,
    missing,
    completeness,
  });

  // Step navigation appears only after the user has chosen "Start manual
  // setup". Decision and CV-import screens show the locked product nav so
  // users see what they're about to unlock — and so they aren't presented
  // with onboarding steps before they've agreed to take that path.
  const navContent =
    screen.kind === "manual" ? (
      <StepNavigation
        current={currentStep}
        statuses={statuses}
        onSelect={manualAt}
      />
    ) : (
      <ProductNavPreview />
    );

  return (
    <OnboardingShell
      nav={navContent}
      assistant={
        <ProfileAssistantPanel
          cvStatus={cvStatus}
          cvFilename={cvFilename}
          completeness={completeness}
          guidance={guidance}
          missingFields={missing.map((m) => m.label)}
          actionLabel={assistantAction?.label}
          actionHint={assistantAction?.hint}
        />
      }
    >
      {screen.kind === "decide" && (
        <div className="mx-auto max-w-[960px]">
          <DecideScreen onImport={chooseImport} onManual={chooseManual} />
        </div>
      )}

      {screen.kind === "import_upload" && (
        <div className="mx-auto max-w-[720px]">
          <ImportUploadScreen
            uploadState={uploadState}
            onFile={handleFile}
            onAnalyze={handleAnalyze}
            onClear={handleClearFile}
            onContinueManually={() =>
              go({
                kind: "manual",
                step: data.full_name ? firstIncompleteStep(data) : 1,
              })
            }
            onBackToDecide={() => go({ kind: "decide" })}
          />
        </div>
      )}

      {screen.kind === "import_review" && (
        <div className="mx-auto max-w-[720px]">
          <ImportReviewScreen
            data={data}
            update={update}
            errors={errors}
            summarizing={summarizing}
            onGenerateSummary={generateSummary}
            completeness={completeness}
            missing={missing}
            onJumpToStep={manualAt}
            detectedLinks={detectedLinks}
            onBack={() => go({ kind: "import_upload" })}
            onSave={handleImportReviewSave}
            saving={saving}
            topError={topError}
          />
        </div>
      )}

      {screen.kind === "manual" && (
        <div className="mx-auto max-w-[720px]">
          <ManualStep
            step={screen.step}
            data={data}
            update={update}
            errors={errors}
            summarizing={summarizing}
            onGenerateSummary={generateSummary}
            completeness={completeness}
            missing={missing}
            onJumpToStep={manualAt}
            onBack={manualBack}
            onNext={manualNext}
            onSave={handleManualSave}
            onUploadCv={helperUploadCv}
            saving={saving}
            topError={topError}
          />
        </div>
      )}
    </OnboardingShell>
  );
}

// ===================================================================
// Helpers
// ===================================================================

function mergeUnique(a: string[], b: string[]): string[] {
  const set = new Set(a.map((s) => s.toLowerCase()));
  const out = [...a];
  for (const item of b) {
    if (!set.has(item.toLowerCase())) {
      out.push(item);
      set.add(item.toLowerCase());
    }
  }
  return out;
}

const STEP_FIELDS: Record<OnboardingStep, (keyof ProfileFormState)[]> = {
  1: [
    "full_name",
    "current_role",
    "location",
    "email",
    "linkedin_url",
    "portfolio_url",
    "preferred_language",
  ],
  2: ["years_of_experience", "professional_summary"],
  3: ["skills", "tools"],
  4: ["languages"],
  5: ["target_role", "target_industries", "preferred_work_format"],
  6: [],
};

function validateStep(
  step: OnboardingStep,
  data: ProfileFormState,
): ProfileFieldErrors {
  const all = validateProfile(data);
  const out: ProfileFieldErrors = {};
  for (const k of STEP_FIELDS[step]) {
    if (all[k]) out[k] = all[k];
  }
  return out;
}

const STEP_REQUIRED: Record<OnboardingStep, (keyof ProfileFormState)[]> = {
  1: ["full_name", "current_role", "email", "preferred_language"],
  2: ["years_of_experience"],
  3: ["skills"],
  4: ["languages"],
  5: ["target_role"],
  6: [],
};

function computeStepStatus(
  id: OnboardingStep,
  current: OnboardingStep | null,
  errors: ProfileFieldErrors,
): StepStatus {
  if (id === current) return "current";
  const stepErrors = STEP_REQUIRED[id].filter((k) => errors[k]);
  if (stepErrors.length === 0) return "complete";
  // Always warn for steps with missing required fields, regardless of
  // position. Lets the user see at a glance which steps still need work.
  return "incomplete";
}

function computeCvStatus(
  uploadState: UploadState,
  cvAnalyzed: boolean,
  screen: Screen,
): CvStatus {
  if (cvAnalyzed) return "analyzed";
  if (uploadState.kind === "selected") return "selected";
  if (uploadState.kind === "analyzing") return "analyzing";
  if (uploadState.kind === "error") return "unreadable";
  if (screen.kind === "manual") return "needs_manual";
  return "none";
}

interface MissingField {
  label: string;
  step: OnboardingStep;
}

// Required-field → step mapping. Each missing entry can be clicked in the
// MissingFieldsActionPanel to jump straight to the relevant onboarding step.
const REQUIRED_FIELDS: ReadonlyArray<{
  key: keyof ProfileFormState;
  label: string;
  step: OnboardingStep;
}> = [
  { key: "full_name", label: "Full name", step: 1 },
  { key: "current_role", label: "Current role", step: 1 },
  { key: "email", label: "Email", step: 1 },
  { key: "preferred_language", label: "Preferred language", step: 1 },
  { key: "years_of_experience", label: "Years of experience", step: 2 },
  { key: "skills", label: "At least one skill", step: 3 },
  { key: "languages", label: "At least one language", step: 4 },
  { key: "target_role", label: "Target role", step: 5 },
];

function missingFieldsList(errors: ProfileFieldErrors): MissingField[] {
  return REQUIRED_FIELDS.filter(({ key }) => errors[key]).map(
    ({ label, step }) => ({ label, step }),
  );
}

function computeGuidance(screen: Screen): string {
  if (screen.kind === "decide") {
    return "Pick the path that fits you best. Importing from a CV is fastest — SoloOS extracts the basics and you only review and tweak.";
  }
  if (screen.kind === "import_upload") {
    return "Upload your CV to let SoloOS extract your experience, skills, tools, and career goals automatically.";
  }
  if (screen.kind === "import_review") {
    return "Review the fields we extracted from your CV. Edit anything that's wrong, then save to unlock SoloOS.";
  }
  return stepById(screen.step).guidance;
}

function computeAssistantAction({
  screen,
  cvStatus,
  missing,
  completeness,
}: {
  screen: Screen;
  cvStatus: CvStatus;
  missing: MissingField[];
  completeness: number;
}): { label: string; hint?: string } | null {
  if (screen.kind === "decide") {
    return {
      label: "Choose a path",
      hint: "Import from CV is the fastest.",
    };
  }
  if (screen.kind === "import_upload") {
    if (cvStatus === "selected")
      return {
        label: "Click Analyze CV",
        hint: "We'll prefill your profile from the document.",
      };
    if (cvStatus === "unreadable")
      return {
        label: "Upload another CV or continue manually",
      };
    return {
      label: "Upload your CV",
      hint: "PDF, up to 10 MB.",
    };
  }
  if (screen.kind === "import_review" || screen.step === 6) {
    if (missing.length > 0)
      return {
        label: "Complete missing fields",
        hint: "Use the list above — they're highlighted in the form.",
      };
    if (completeness < COVER_LETTER_MIN_COMPLETENESS)
      return {
        label: "Add more profile detail",
        hint: `Reach ${COVER_LETTER_MIN_COMPLETENESS}% to unlock the workspace.`,
      };
    return { label: "Save profile" };
  }
  if (missing.length > 0) {
    return { label: "Complete missing fields" };
  }
  return { label: "Continue" };
}

// ===================================================================
// Screens
// ===================================================================

function DecideScreen({
  onImport,
  onManual,
}: {
  onImport: () => void;
  onManual: () => void;
}) {
  return (
    <div className="space-y-10">
      <header>
        <div className="text-small uppercase tracking-wide text-muted-foreground">
          Welcome
        </div>
        <h1 className="pt-2 text-hero tracking-tight">
          Build your career profile
        </h1>
        <p className="pt-2 max-w-2xl text-body text-secondary-foreground">
          SoloOS needs some career information to generate strong job
          applications. Pick the path that fits you best.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <DecideCard
          icon={<FileUp className="h-6 w-6" />}
          eyebrow="Fastest way"
          title="Import from CV"
          body="Upload your CV and SoloOS will automatically build your career profile."
          buttonLabel="Upload CV"
          onClick={onImport}
          recommended
        />
        <DecideCard
          icon={<PencilLine className="h-6 w-6" />}
          eyebrow="Step by step"
          title="Build profile manually"
          body="Fill in your career details step by step. You can switch to importing a CV at any point."
          buttonLabel="Start manual setup"
          onClick={onManual}
        />
      </div>
    </div>
  );
}

function DecideCard({
  icon,
  eyebrow,
  title,
  body,
  buttonLabel,
  onClick,
  recommended,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  buttonLabel: string;
  onClick: () => void;
  recommended?: boolean;
}) {
  return (
    <div className="group flex min-h-[320px] flex-col justify-between gap-8 rounded-xl border border-border bg-surface p-8 transition-colors hover:border-primary/40 hover:bg-surface-elevated">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated text-foreground transition-colors group-hover:bg-primary/15 group-hover:text-primary">
            {icon}
          </span>
          {recommended && (
            <span className="rounded-md bg-primary/15 px-2.5 py-1 text-small font-medium text-primary">
              Recommended
            </span>
          )}
        </div>
        <div>
          <div className="text-small uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </div>
          <div className="pt-2 text-h2 tracking-tight">{title}</div>
          <p className="pt-2 text-body text-secondary-foreground">{body}</p>
        </div>
      </div>
      <Button onClick={onClick} size="lg" className="self-start">
        {buttonLabel}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ImportUploadScreen({
  uploadState,
  onFile,
  onAnalyze,
  onClear,
  onContinueManually,
  onBackToDecide,
}: {
  uploadState: UploadState;
  onFile: (f: File) => void;
  onAnalyze: () => void;
  onClear: () => void;
  onContinueManually: () => void;
  onBackToDecide: () => void;
}) {
  const analyzing = uploadState.kind === "analyzing";
  return (
    <div className="space-y-7">
      <header>
        <div className="text-small uppercase tracking-wide text-muted-foreground">
          CV import
        </div>
        <h1 className="pt-2 text-h1 tracking-tight">Upload your CV</h1>
        <p className="pt-1.5 text-body text-secondary-foreground">
          PDF, up to 10 MB. SoloOS will extract your role, experience, skills
          and tools.
        </p>
      </header>

      <UploadCVCard
        state={uploadState}
        onFile={onFile}
        onAnalyze={onAnalyze}
        onClear={onClear}
        onContinueManually={onContinueManually}
      />

      <div className="text-small text-muted-foreground">
        Prefer to type it out?{" "}
        <button
          type="button"
          onClick={onContinueManually}
          className="text-primary hover:underline"
          disabled={analyzing}
        >
          Continue manually
        </button>
      </div>

      <footer className="mt-2 flex items-center justify-between border-t border-border pt-6">
        <Button variant="ghost" onClick={onBackToDecide} disabled={analyzing}>
          Back
        </Button>
        <span aria-hidden />
      </footer>
    </div>
  );
}

function ImportReviewScreen({
  data,
  update,
  errors,
  summarizing,
  onGenerateSummary,
  completeness,
  missing,
  onJumpToStep,
  detectedLinks,
  onBack,
  onSave,
  saving,
  topError,
}: {
  data: ProfileFormState;
  update: <K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K],
  ) => void;
  errors: ProfileFieldErrors;
  summarizing: boolean;
  onGenerateSummary: () => void;
  completeness: number;
  missing: MissingField[];
  onJumpToStep: (step: OnboardingStep) => void;
  detectedLinks: DetectedLink[];
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  topError: string | null;
}) {
  return (
    <div className="space-y-7">
      <header>
        <div className="text-small uppercase tracking-wide text-muted-foreground">
          CV import / Profile review
        </div>
        <h1 className="pt-2 text-h1 tracking-tight">Review extracted profile</h1>
        <p className="pt-1.5 text-body text-secondary-foreground">
          We pulled this from your CV. Edit anything that doesn&apos;t look
          right, then save.
        </p>
      </header>

      <DetectedLinksSection links={detectedLinks} data={data} />

      <BasicInfoFields data={data} update={update} errors={errors} />
      <ExperienceFields
        data={data}
        update={update}
        errors={errors}
        summarizing={summarizing}
        onGenerateSummary={onGenerateSummary}
      />
      <SkillsFields data={data} update={update} errors={errors} />
      <LanguagesFields data={data} update={update} errors={errors} />
      <GoalsFields data={data} update={update} errors={errors} />

      <FormSection
        title="You're at"
        description={
          completeness >= COVER_LETTER_MIN_COMPLETENESS
            ? "Your profile is complete enough to unlock the workspace. Save when you're ready."
            : `Add the highlighted fields to reach ${COVER_LETTER_MIN_COMPLETENESS}%.`
        }
      >
        <div className="text-h1 tabular-nums">{completeness}%</div>
      </FormSection>

      <MissingFieldsActionPanel items={missing} onJumpToStep={onJumpToStep} />

      {topError && (
        <p
          role="alert"
          className="whitespace-pre-wrap break-words text-small text-destructive"
        >
          {topError}
        </p>
      )}

      <footer className="flex items-center justify-between border-t border-border pt-6">
        <Button variant="ghost" onClick={onBack} disabled={saving}>
          Back
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="animate-spin" />
              Saving…
            </>
          ) : (
            "Save profile"
          )}
        </Button>
      </footer>
    </div>
  );
}

function ManualStep({
  step,
  data,
  update,
  errors,
  summarizing,
  onGenerateSummary,
  completeness,
  missing,
  onJumpToStep,
  onBack,
  onNext,
  onSave,
  onUploadCv,
  saving,
  topError,
}: {
  step: OnboardingStep;
  data: ProfileFormState;
  update: <K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K],
  ) => void;
  errors: ProfileFieldErrors;
  summarizing: boolean;
  onGenerateSummary: () => void;
  completeness: number;
  missing: MissingField[];
  onJumpToStep: (step: OnboardingStep) => void;
  onBack: () => void;
  onNext: () => void;
  onSave: () => void;
  onUploadCv: () => void;
  saving: boolean;
  topError: string | null;
}) {
  const def = stepById(step);
  return (
    <div className="space-y-7">
      <UploadHelperCard onUploadCv={onUploadCv} />

      <header>
        <div className="text-small uppercase tracking-wide text-muted-foreground">
          {def.eyebrow}
        </div>
        <h1 className="pt-2 text-h1 tracking-tight">{def.title}</h1>
        <p className="pt-1.5 text-body text-secondary-foreground">
          {def.subtitle}
        </p>
      </header>

      {step === 1 && <BasicInfoFields data={data} update={update} errors={errors} />}
      {step === 2 && (
        <ExperienceFields
          data={data}
          update={update}
          errors={errors}
          summarizing={summarizing}
          onGenerateSummary={onGenerateSummary}
        />
      )}
      {step === 3 && <SkillsFields data={data} update={update} errors={errors} />}
      {step === 4 && (
        <LanguagesFields data={data} update={update} errors={errors} />
      )}
      {step === 5 && <GoalsFields data={data} update={update} errors={errors} />}
      {step === 6 && (
        <ReviewStep
          data={data}
          errors={errors}
          completeness={completeness}
          missing={missing}
          onJumpToStep={onJumpToStep}
        />
      )}

      {topError && (
        <p
          role="alert"
          className="whitespace-pre-wrap break-words text-small text-destructive"
        >
          {topError}
        </p>
      )}

      <footer className="mt-2 flex items-center justify-between border-t border-border pt-6">
        <Button variant="ghost" onClick={onBack} disabled={saving}>
          Back
        </Button>
        {step === 6 ? (
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="animate-spin" />
                Saving…
              </>
            ) : (
              "Save profile"
            )}
          </Button>
        ) : (
          <Button onClick={onNext} disabled={saving}>
            Continue
          </Button>
        )}
      </footer>
    </div>
  );
}

function UploadHelperCard({ onUploadCv }: { onUploadCv: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-elevated text-foreground">
          <Upload className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-small font-medium text-foreground">
            Already have a CV?
          </div>
          <div className="truncate text-small text-muted-foreground">
            Upload it and SoloOS will fill most fields automatically.
          </div>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onUploadCv}>
        Upload CV
      </Button>
    </div>
  );
}

// ===================================================================
// Field groups (shared between import:review and manual steps)
// ===================================================================

interface FieldsProps {
  data: ProfileFormState;
  update: <K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K],
  ) => void;
  errors: ProfileFieldErrors;
}

function BasicInfoFields({ data, update, errors }: FieldsProps) {
  return (
    <FormSection title="Basic information">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="Full name"
          required
          error={errors.full_name}
          className="sm:col-span-2"
          id="full_name"
        >
          <Input
            id="full_name"
            value={data.full_name}
            onChange={(e) => update("full_name", e.target.value)}
            maxLength={80}
            placeholder="Alex Morgan"
          />
        </FormField>
        <FormField
          label="Current role"
          required
          error={errors.current_role}
          id="current_role"
        >
          <Input
            id="current_role"
            value={data.current_role}
            onChange={(e) => update("current_role", e.target.value)}
            maxLength={80}
            placeholder="Product Designer"
          />
        </FormField>
        <FormField label="Location" error={errors.location} id="location">
          <Input
            id="location"
            value={data.location}
            onChange={(e) => update("location", e.target.value)}
            maxLength={80}
            placeholder="Yerevan, Armenia"
          />
        </FormField>
        <FormField label="Email" required error={errors.email} id="email">
          <Input
            id="email"
            type="email"
            value={data.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="alex@email.com"
          />
        </FormField>
        <FormField
          label="Preferred language"
          required
          error={errors.preferred_language}
          id="preferred_language"
        >
          <Select
            id="preferred_language"
            value={data.preferred_language}
            onChange={(e) =>
              update("preferred_language", e.target.value as Language)
            }
          >
            <option value="en">English</option>
            <option value="ru">Russian</option>
            <option value="hy">Armenian</option>
          </Select>
        </FormField>
        <FormField
          label="LinkedIn URL"
          error={errors.linkedin_url}
          id="linkedin_url"
        >
          <Input
            id="linkedin_url"
            value={data.linkedin_url}
            onChange={(e) => update("linkedin_url", e.target.value)}
            placeholder="https://linkedin.com/in/alexmorgan"
          />
        </FormField>
        <FormField
          label="Portfolio URL"
          error={errors.portfolio_url}
          id="portfolio_url"
        >
          <Input
            id="portfolio_url"
            value={data.portfolio_url}
            onChange={(e) => update("portfolio_url", e.target.value)}
            placeholder="https://alexmorgan.design"
          />
        </FormField>
      </div>
    </FormSection>
  );
}

function ExperienceFields({
  data,
  update,
  errors,
  summarizing,
  onGenerateSummary,
}: FieldsProps & {
  summarizing: boolean;
  onGenerateSummary: () => void;
}) {
  const canGenerate =
    !summarizing &&
    (data.current_role.trim().length > 0 || data.skills.length > 0);
  return (
    <FormSection title="Experience">
      <FormField
        label="Years of experience"
        required
        error={errors.years_of_experience}
        hint="0–50"
        id="years_of_experience"
      >
        <Input
          id="years_of_experience"
          inputMode="numeric"
          pattern="[0-9]*"
          value={data.years_of_experience}
          onChange={(e) =>
            update(
              "years_of_experience",
              e.target.value.replace(/[^\d]/g, "").slice(0, 2),
            )
          }
          placeholder="Example: 6"
          className="max-w-[160px]"
        />
      </FormField>

      <FormField
        label="Professional summary"
        error={errors.professional_summary}
        meta={<CharCounter value={data.professional_summary} max={SUMMARY_MAX} />}
        id="professional_summary"
      >
        <Textarea
          id="professional_summary"
          rows={5}
          maxLength={SUMMARY_MAX}
          value={data.professional_summary}
          onChange={(e) => update("professional_summary", e.target.value)}
          placeholder="Product designer with 6+ years of experience designing SaaS platforms."
        />
        <div className="flex items-center gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onGenerateSummary}
            disabled={!canGenerate}
          >
            {summarizing ? (
              <>
                <Loader2 className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate with AI
              </>
            )}
          </Button>
          <span className="text-small text-muted-foreground">
            Uses your filled fields. Won&apos;t invent experience.
          </span>
        </div>
      </FormField>
    </FormSection>
  );
}

function SkillsFields({ data, update, errors }: FieldsProps) {
  return (
    <FormSection title="Skills and tools">
      <FormField label="Skills" required error={errors.skills}>
        <TagInput
          value={data.skills}
          onChange={(next) => update("skills", next)}
          placeholder="Add skill…"
          max={20}
          examples="UX Research • Prototyping • Design Systems"
        />
      </FormField>
      <FormField label="Tools" error={errors.tools}>
        <TagInput
          value={data.tools}
          onChange={(next) => update("tools", next)}
          placeholder="Add tool…"
          max={20}
          examples="Figma • Notion • Linear"
        />
      </FormField>
    </FormSection>
  );
}

function LanguagesFields({ data, update, errors }: FieldsProps) {
  return (
    <FormSection
      title="Spoken languages"
      description="At least one is required."
    >
      <FormField label="Languages" required error={errors.languages}>
        <LanguageEditor
          value={data.languages}
          onChange={(next) => update("languages", next)}
        />
      </FormField>
    </FormSection>
  );
}

function GoalsFields({ data, update, errors }: FieldsProps) {
  return (
    <div className="space-y-6">
      <FormSection title="Target role">
        <FormField
          label="Target role"
          required
          error={errors.target_role}
          id="target_role"
        >
          <Input
            id="target_role"
            value={data.target_role}
            onChange={(e) => update("target_role", e.target.value)}
            maxLength={80}
            placeholder="Senior Product Designer"
          />
        </FormField>
        <FormField label="Target industries" error={errors.target_industries}>
          <TagInput
            value={data.target_industries}
            onChange={(next) => update("target_industries", next)}
            placeholder="Add industry…"
            max={10}
            examples="SaaS • Fintech • Developer Tools"
          />
        </FormField>
      </FormSection>

      <FormSection title="Work format and salary">
        <FormField label="Preferred work format" id="preferred_work_format">
          <Select
            id="preferred_work_format"
            value={data.preferred_work_format}
            onChange={(e) => update("preferred_work_format", e.target.value)}
          >
            <option value="">No preference</option>
            <option value="Remote">Remote</option>
            <option value="Hybrid">Hybrid</option>
            <option value="On-site">On-site</option>
            <option value="Flexible">Flexible</option>
          </Select>
        </FormField>
        <FormField label="Salary expectation">
          <SalaryInput
            value={data.salary}
            onChange={(next) => update("salary", next)}
          />
        </FormField>
      </FormSection>
    </div>
  );
}

function ReviewStep({
  data,
  errors,
  completeness,
  missing,
  onJumpToStep,
}: {
  data: ProfileFormState;
  errors: ProfileFieldErrors;
  completeness: number;
  missing: MissingField[];
  onJumpToStep: (step: OnboardingStep) => void;
}) {
  const allErrors = useMemo(() => validateProfile(data), [data]);
  const blockingErrors = { ...allErrors, ...errors };
  const reachable = completeness >= COVER_LETTER_MIN_COMPLETENESS;
  return (
    <div className="space-y-5">
      <FormSection
        title="You're at"
        description={
          reachable
            ? "Your profile is complete enough to unlock the workspace. Save when you're ready."
            : `Add the highlighted fields to reach ${COVER_LETTER_MIN_COMPLETENESS}%.`
        }
      >
        <div className="text-h1 tabular-nums">{completeness}%</div>
      </FormSection>

      <ReviewBlock title="Basic information">
        <ReviewRow label="Full name *" value={data.full_name} required error={blockingErrors.full_name} />
        <ReviewRow label="Current role *" value={data.current_role} required error={blockingErrors.current_role} />
        <ReviewRow label="Location" value={data.location} />
        <ReviewRow label="Email *" value={data.email} required error={blockingErrors.email} />
        <ReviewRow label="LinkedIn" value={data.linkedin_url} error={blockingErrors.linkedin_url} />
        <ReviewRow label="Portfolio" value={data.portfolio_url} error={blockingErrors.portfolio_url} />
        <ReviewRow
          label="Preferred language *"
          value={
            ({ en: "English", ru: "Russian", hy: "Armenian" } as Record<
              Language,
              string
            >)[data.preferred_language]
          }
          required
        />
      </ReviewBlock>

      <ReviewBlock title="Experience">
        <ReviewRow
          label="Years of experience *"
          value={data.years_of_experience}
          required
          error={blockingErrors.years_of_experience}
        />
        <ReviewRow
          label="Professional summary"
          value={data.professional_summary}
          error={blockingErrors.professional_summary}
        />
      </ReviewBlock>

      <ReviewBlock title="Skills and tools">
        <ReviewRow
          label="Skills *"
          value={data.skills.join(", ")}
          required
          error={blockingErrors.skills}
        />
        <ReviewRow label="Tools" value={data.tools.join(", ")} />
      </ReviewBlock>

      <ReviewBlock title="Languages">
        <ReviewRow
          label="Languages *"
          value={
            data.languages.length > 0
              ? data.languages.map((l) => `${l.name} — ${l.level}`).join(", ")
              : ""
          }
          required
          error={blockingErrors.languages}
        />
      </ReviewBlock>

      <ReviewBlock title="Career goals">
        <ReviewRow
          label="Target role *"
          value={data.target_role}
          required
          error={blockingErrors.target_role}
        />
        <ReviewRow
          label="Target industries"
          value={data.target_industries.join(", ")}
        />
        <ReviewRow
          label="Preferred work format"
          value={data.preferred_work_format}
        />
        <ReviewRow
          label="Salary expectation"
          value={formatReviewSalary(data.salary)}
        />
      </ReviewBlock>

      <MissingFieldsActionPanel items={missing} onJumpToStep={onJumpToStep} />
    </div>
  );
}

// Compose a human-readable salary expectation from the structured fields
// for display on the review summary. Returns "" if neither min nor max is set.
function formatReviewSalary(salary: ProfileFormState["salary"]): string {
  const min = salary.min.trim();
  const max = salary.max.trim();
  if (!min && !max) return "";
  const period = salary.period;
  const range = min && max ? `${min} – ${max}` : min ? `from ${min}` : `up to ${max}`;
  return `${salary.currency} ${range} ${period}`;
}

function ReviewBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <FormSection title={title}>
      <dl className="divide-y divide-border">{children}</dl>
    </FormSection>
  );
}

function MissingFieldsActionPanel({
  items,
  onJumpToStep,
}: {
  items: MissingField[];
  onJumpToStep: (step: OnboardingStep) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-5">
      <div className="text-small font-medium text-destructive">
        Complete these fields to save your profile:
      </div>
      <ul className="mt-3 space-y-1">
        {items.map((item) => (
          <li key={`${item.label}-${item.step}`}>
            <button
              type="button"
              onClick={() => onJumpToStep(item.step)}
              className="group flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-small text-foreground hover:bg-destructive/15"
            >
              <span className="truncate">{item.label}</span>
              <span className="text-small text-muted-foreground group-hover:text-foreground">
                Step {item.step} →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  required,
  error,
}: {
  label: string;
  value: string;
  required?: boolean;
  error?: string;
}) {
  const empty = !value;
  const showAsMissing = required && (empty || !!error);
  return (
    <div
      className={cn(
        "grid grid-cols-[200px_1fr] gap-3 rounded-md px-3 py-2.5 -mx-3",
        showAsMissing && "bg-destructive/10 ring-1 ring-inset ring-destructive/30",
      )}
    >
      <dt
        className={cn(
          "text-small",
          showAsMissing
            ? "font-medium text-destructive"
            : "text-muted-foreground",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "min-w-0 break-words text-small",
          empty
            ? showAsMissing
              ? "text-destructive"
              : "text-muted-foreground"
            : "text-foreground",
        )}
      >
        {error ? error : empty ? (showAsMissing ? "Missing" : "—") : value}
      </dd>
    </div>
  );
}

// =============================================================
// Detected links
// =============================================================

function DetectedLinksSection({
  links,
  data,
}: {
  links: DetectedLink[];
  data: ProfileFormState;
}) {
  // Pick the highest-confidence linkedin and portfolio matches from the
  // raw detected list. The route already ran the same selection — we
  // re-derive client-side so the UI doesn't need to round-trip extra fields.
  const linkedinLink = links
    .filter((l) => l.type === "linkedin" && l.confidence >= 0.9)
    .sort((a, b) => b.confidence - a.confidence)[0];
  const portfolioPlatform = links
    .filter((l) => l.type === "portfolio_platform")
    .sort((a, b) => b.confidence - a.confidence)[0];
  const personalSite = links
    .filter((l) => l.type === "personal")
    .sort((a, b) => b.confidence - a.confidence)[0];
  const portfolioLink = portfolioPlatform ?? personalSite;

  if (!linkedinLink && !portfolioLink) return null;

  return (
    <FormSection
      title="Detected links"
      description="From your CV. Used badges show what was applied to the profile."
    >
      <ul className="space-y-2">
        {linkedinLink && (
          <DetectedLinkRow
            label="LinkedIn"
            url={linkedinLink.url}
            used={data.linkedin_url === linkedinLink.url}
          />
        )}
        {portfolioLink && (
          <DetectedLinkRow
            label="Portfolio"
            url={portfolioLink.url}
            used={data.portfolio_url === portfolioLink.url}
          />
        )}
      </ul>
    </FormSection>
  );
}

function DetectedLinkRow({
  label,
  url,
  used,
}: {
  label: string;
  url: string;
  used: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-elevated px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-small font-medium text-foreground">{label}</div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-small text-muted-foreground hover:text-primary"
        >
          {url}
        </a>
      </div>
      {used && (
        <span className="shrink-0 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-small text-success">
          Used
        </span>
      )}
    </li>
  );
}
