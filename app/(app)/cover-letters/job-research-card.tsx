"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  ChevronDown,
  Globe,
  Languages,
  Loader2,
  Maximize2,
  Sparkles,
  X,
} from "lucide-react";
import { useT } from "@/lib/i18n/hooks";
import type { OutputLanguage } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";
import type { JobResearch } from "@/lib/job-research/types";

export type JobResearchState =
  | { kind: "idle" }
  | { kind: "analyzing"; url: string }
  | { kind: "ready"; research: JobResearch }
  | { kind: "failed"; title: string; subtext: string };

interface Props {
  state: JobResearchState;
  // Re-normalization status: when non-null, an in-flight call to
  // /api/ai/normalize-research is translating the existing research into
  // this target language. The card overlays a small status banner.
  normalizing: OutputLanguage | null;
  // Soft error from a failed re-normalization. The previous (now
  // language-stale) research stays visible so the user can re-analyze or
  // switch to manual mode without losing the extracted context.
  normalizeError: { title: string; body: string } | null;
  onDismissNormalizeError: () => void;
  onTryAnotherLink: () => void;
  onSwitchToManual: () => void;
}

export function JobResearchCard({
  state,
  normalizing,
  normalizeError,
  onDismissNormalizeError,
  onTryAnotherLink,
  onSwitchToManual,
}: Props) {
  const t = useT();
  const tt = (key: string, vars?: Record<string, string | number>) =>
    t(`cover_letter.${key}`, vars);

  if (state.kind === "idle") {
    return <Empty t={tt} />;
  }
  if (state.kind === "analyzing") {
    return <Analyzing url={state.url} t={tt} />;
  }
  if (state.kind === "failed") {
    return (
      <Failed
        title={state.title}
        subtext={state.subtext}
        onTryAnotherLink={onTryAnotherLink}
        onSwitchToManual={onSwitchToManual}
        t={tt}
      />
    );
  }
  return (
    <Ready
      research={state.research}
      normalizing={normalizing}
      normalizeError={normalizeError}
      onDismissNormalizeError={onDismissNormalizeError}
      t={tt}
    />
  );
}

function Empty({
  t,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-surface-elevated/40 px-6 py-8 text-center">
      <div className="flex flex-col items-center gap-2">
        <Globe className="h-5 w-5 text-muted-foreground" />
        <div className="text-small text-foreground">
          {t("research.empty_title")}
        </div>
        <p className="text-small text-muted-foreground">
          {t("research.empty_body")}
        </p>
      </div>
    </div>
  );
}

function Analyzing({
  url,
  t,
}: {
  url: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-3 rounded-md border border-border bg-surface-elevated p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
        <div className="min-w-0">
          <div className="text-small font-medium text-foreground">
            {t("research.analyzing_title")}
          </div>
          <p className="truncate text-small text-muted-foreground">{url}</p>
        </div>
      </div>
      <p className="text-small text-muted-foreground">
        {t("research.analyzing_body")}
      </p>
    </div>
  );
}

function Failed({
  title,
  subtext,
  onTryAnotherLink,
  onSwitchToManual,
  t,
}: {
  title: string;
  subtext: string;
  onTryAnotherLink: () => void;
  onSwitchToManual: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div
      role="alert"
      className="flex shrink-0 flex-col gap-3 rounded-md border border-warning/30 bg-warning/5 p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-small font-medium text-foreground">{title}</div>
          <p className="pt-0.5 text-small text-muted-foreground">{subtext}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onTryAnotherLink}
          className="inline-flex h-8 items-center rounded-md border border-border bg-surface-elevated px-3 text-small text-foreground hover:border-primary/40"
        >
          {t("research.try_another_link")}
        </button>
        <button
          type="button"
          onClick={onSwitchToManual}
          className="inline-flex h-8 items-center rounded-md border border-border bg-transparent px-3 text-small text-foreground hover:border-primary/40 hover:bg-surface-elevated"
        >
          {t("research.paste_manually")}
        </button>
      </div>
    </div>
  );
}

function Ready({
  research,
  normalizing,
  normalizeError,
  onDismissNormalizeError,
  t,
}: {
  research: JobResearch;
  normalizing: OutputLanguage | null;
  normalizeError: { title: string; body: string } | null;
  onDismissNormalizeError: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const heading = [research.job_title, research.company_name]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <ReadySummary
        heading={heading || t("research.analyzed_fallback")}
        normalizing={normalizing}
        normalizeError={normalizeError}
        onExpand={() => setExpanded(true)}
        t={t}
      />
      <Dialog.Root open={expanded} onOpenChange={setExpanded}>
        <Dialog.Portal>
          <Dialog.Overlay
            className={cn(
              "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            )}
          />
          <Dialog.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 flex w-[min(960px,92vw)] max-h-[88vh] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            )}
            aria-describedby={undefined}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-surface-elevated px-6 py-4">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="truncate text-h3 tracking-tight">
                  {heading || t("research.analyzed_fallback")}
                </Dialog.Title>
                {research.job_summary && (
                  <p className="pt-1 text-small text-muted-foreground">
                    {research.job_summary}
                  </p>
                )}
              </div>
              <Dialog.Close
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
                  "hover:bg-surface hover:text-foreground",
                )}
                aria-label={t("research.expand.close")}
              >
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <ReadyBody
                research={research}
                normalizing={normalizing}
                normalizeError={normalizeError}
                onDismissNormalizeError={onDismissNormalizeError}
                t={t}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

// Inline summary chip — a single-row pill after analysis: status icon,
// role/company heading, maximize button. All depth lives in the expand
// dialog. The chip height never changes: re-normalize / error states
// swap the leading icon + title text in place rather than adding a
// banner below, so the chip can never push or overlap the SetupPanel
// underneath it.
function ReadySummary({
  heading,
  normalizing,
  normalizeError,
  onExpand,
  t,
}: {
  heading: string;
  normalizing: OutputLanguage | null;
  normalizeError: { title: string; body: string } | null;
  onExpand: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  // State precedence: normalizing > normalizeError > ready. The error
  // surfaces only when we're not also showing the spinner — otherwise a
  // rapid retoggle would briefly flash the error then loader.
  const state: "ready" | "normalizing" | "error" = normalizing
    ? "normalizing"
    : normalizeError
      ? "error"
      : "ready";
  const localizedTarget = normalizing
    ? t(`language.${normalizing.toLowerCase()}`)
    : "";
  const displayTitle =
    state === "normalizing"
      ? t("research.translating_title", { target: localizedTarget })
      : state === "error"
        ? (normalizeError?.title ?? heading)
        : heading;
  const tooltip =
    state === "normalizing"
      ? t("research.translating_body")
      : state === "error"
        ? (normalizeError?.body ?? "")
        : t("research.expand.title");
  return (
    <button
      type="button"
      onClick={onExpand}
      title={tooltip}
      className={cn(
        "group flex shrink-0 items-center gap-3 rounded-md border bg-surface-elevated px-4 py-3 text-left transition-colors",
        state === "normalizing" && "border-primary/30",
        state === "error" && "border-warning/40",
        state === "ready" && "border-border hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          state === "normalizing" && "bg-primary/15 text-primary",
          state === "error" && "bg-warning/15 text-warning",
          state === "ready" && "bg-success/15 text-success",
        )}
      >
        {state === "normalizing" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === "error" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-small font-medium text-foreground">
        {displayTitle}
      </span>
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
          "group-hover:bg-surface group-hover:text-foreground",
        )}
        aria-label={t("research.expand.title")}
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

// Full content body. Only ever rendered inside the expanded Dialog now
// — the inline view is the slim summary chip above. Has plenty of room,
// so both "Extracting context" and "Show original" start open and use
// the larger body type.
function ReadyBody({
  research,
  normalizing,
  normalizeError,
  onDismissNormalizeError,
  t,
}: {
  research: JobResearch;
  normalizing: OutputLanguage | null;
  normalizeError: { title: string; body: string } | null;
  onDismissNormalizeError: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [showRaw, setShowRaw] = useState(true);
  const [showOriginal, setShowOriginal] = useState(true);
  const wasTranslated = research.source_language !== research.output_language;
  return (
    <div className="flex flex-col gap-4">
      <LanguageMetaRow
        sourceLanguage={research.source_language}
        outputLanguage={research.output_language}
        wasTranslated={wasTranslated}
        t={t}
      />

      {normalizing && <NormalizingBanner target={normalizing} t={t} />}
      {normalizeError && !normalizing && (
        <NormalizeErrorBanner
          title={normalizeError.title}
          body={normalizeError.body}
          onDismiss={onDismissNormalizeError}
        />
      )}

      {research.useful_signals.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {research.useful_signals.map((sig, i) => (
            <li
              key={`${sig}-${i}`}
              className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-small text-secondary-foreground"
            >
              {sig}
            </li>
          ))}
        </ul>
      )}

      <details
        className="group rounded-md border border-border bg-background p-4"
        open={showRaw}
        onToggle={(e) => setShowRaw((e.target as HTMLDetailsElement).open)}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between text-small font-medium text-foreground">
          {t("research.extracting_context")}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              showRaw && "rotate-180",
            )}
          />
        </summary>
        <div className="mt-4 space-y-4 text-body leading-7 text-muted-foreground">
          {research.company_context && (
            <ContextRow label={t("research.context.company")}>
              {research.company_context}
            </ContextRow>
          )}
          {research.product_context && (
            <ContextRow label={t("research.context.product")}>
              {research.product_context}
            </ContextRow>
          )}
          {research.responsibilities && (
            <ContextRow label={t("research.context.responsibilities")}>
              {research.responsibilities}
            </ContextRow>
          )}
          {research.requirements && (
            <ContextRow label={t("research.context.requirements")}>
              {research.requirements}
            </ContextRow>
          )}
          {research.tone && (
            <ContextRow label={t("research.context.tone")}>
              {research.tone}
            </ContextRow>
          )}
        </div>
      </details>

      {wasTranslated && research.raw_excerpt && (
        <details
          className="rounded-md border border-border bg-background p-4"
          open={showOriginal}
          onToggle={(e) =>
            setShowOriginal((e.target as HTMLDetailsElement).open)
          }
        >
          <summary className="flex cursor-pointer list-none items-center justify-between text-small font-medium text-foreground">
            {showOriginal
              ? t("research.language_meta.hide_original")
              : t("research.language_meta.show_original")}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                showOriginal && "rotate-180",
              )}
            />
          </summary>
          <div className="mt-3 space-y-1 text-small">
            <div className="uppercase tracking-wide text-muted-foreground">
              {t("research.language_meta.original_excerpt_label")}
            </div>
            <pre className="whitespace-pre-wrap font-sans text-body leading-7 text-foreground">
              {research.raw_excerpt}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
}

function LanguageMetaRow({
  sourceLanguage,
  outputLanguage,
  wasTranslated,
  t,
}: {
  sourceLanguage: OutputLanguage;
  outputLanguage: OutputLanguage;
  wasTranslated: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const sourceLabel = t(`language.${sourceLanguage.toLowerCase()}`);
  const outputLabel = t(`language.${outputLanguage.toLowerCase()}`);
  return (
    <div className="flex flex-wrap items-center gap-2 text-small">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-muted-foreground">
        <Languages className="h-3.5 w-3.5" />
        <span>{t("research.language_meta.source")}</span>
        <span className="text-border">·</span>
        <span className="font-medium text-foreground">{sourceLabel}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-muted-foreground">
        <span>{t("research.language_meta.output")}</span>
        <span className="text-border">·</span>
        <span className="font-medium text-foreground">{outputLabel}</span>
      </span>
      {wasTranslated && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-primary">
          <Sparkles className="h-3 w-3" />
          {t("research.language_meta.translated")}
        </span>
      )}
    </div>
  );
}

function NormalizingBanner({
  target,
  t,
}: {
  target: OutputLanguage;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const localized = t(`language.${target.toLowerCase()}`);
  return (
    <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
      <div className="min-w-0 flex-1">
        <div className="text-small font-medium text-foreground">
          {t("research.translating_title", { target: localized })}
        </div>
        <p className="text-small text-muted-foreground">
          {t("research.translating_body")}
        </p>
      </div>
    </div>
  );
}

function NormalizeErrorBanner({
  title,
  body,
  onDismiss,
}: {
  title: string;
  body: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/5 p-3"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div className="min-w-0 flex-1">
        <div className="text-small font-medium text-foreground">{title}</div>
        <p className="text-small text-muted-foreground">{body}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ContextRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-small uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-small text-foreground">{children}</div>
    </div>
  );
}
