"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  AlertCircle,
  ChevronDown,
  Copy,
  Download,
  Globe,
  Languages,
  Loader2,
  Mail,
  PencilLine,
  RefreshCw,
  Save,
  Scissors,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/hooks";
import { OUTPUT_LANGUAGES, type OutputLanguage } from "@/lib/i18n/types";
import type { JobResearch } from "@/lib/job-research/types";
import { cn } from "@/lib/utils";
import {
  deleteCoverLetterAction,
  updateCoverLetterAction,
} from "../actions";
import { MoreMenu, type ToneVariant } from "../more-menu";
import { useActionLock } from "@/lib/ui/action-lock";
import { useToast } from "@/lib/ui/toast";

const TONE_VARIANTS: ReadonlyArray<ToneVariant> = [
  "confident",
  "friendly",
  "formal",
  "startup",
];

type TransformMode = "shorten" | "stronger" | ToneVariant;

interface LetterDetail {
  id: string;
  content: string;
  job_title: string | null;
  company_name: string | null;
  language: OutputLanguage | null;
  source_type: "manual" | "job_link" | null;
  source_url: string | null;
  job_description: string | null;
  job_research: JobResearch | null;
  channel: "platform" | "direct" | null;
  recipient_name: string | null;
  created_at: string;
  updated_at: string | null;
}

interface Props {
  letter: LetterDetail;
}

interface ErrorState {
  title: string;
  body: string;
}

export function LetterDetailEditor({ letter }: Props) {
  const router = useRouter();
  const t = useT();
  const tt = (key: string, vars?: Record<string, string | number>) =>
    t(`cover_letter.${key}`, vars);

  const [content, setContent] = useState(letter.content);
  const [language, setLanguage] = useState<OutputLanguage | null>(
    letter.language,
  );
  const [savedContent, setSavedContent] = useState(letter.content);
  const [savedLanguage, setSavedLanguage] = useState<OutputLanguage | null>(
    letter.language,
  );

  const [savingPending, startSave] = useTransition();
  const [activeTransform, setActiveTransform] = useState<TransformMode | null>(
    null,
  );
  const [translating, setTranslating] = useState<OutputLanguage | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingPending, startDelete] = useTransition();

  const [error, setError] = useState<ErrorState | null>(null);
  const { toast } = useToast();
  const { run, isLocked } = useActionLock();

  const dirty = content !== savedContent || language !== savedLanguage;
  const busy =
    savingPending ||
    activeTransform != null ||
    translating != null ||
    regenerating ||
    deletingPending ||
    isLocked;

  // Keep local state in sync if the server-loaded prop changes (e.g. after
  // router.refresh from a different action).
  useEffect(() => {
    setContent(letter.content);
    setSavedContent(letter.content);
    setLanguage(letter.language);
    setSavedLanguage(letter.language);
  }, [letter.id, letter.content, letter.language]);

  // ---------- Save ----------
  function handleSave() {
    if (!dirty || busy) return;
    setError(null);
    startSave(async () => {
      const result = await updateCoverLetterAction({
        id: letter.id,
        content,
        language,
      });
      if (!result.ok) {
        setError({ title: tt("errors.save_title"), body: result.error });
        return;
      }
      setSavedContent(content);
      setSavedLanguage(language);
      toast.success(t("common.toast.saved_letter"));
      router.refresh();
    });
  }

  // ---------- Copy ----------
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      toast.success(tt("actions.copy_success"));
    } catch {
      setError({
        title: tt("errors.copy_title"),
        body: tt("errors.copy_body"),
      });
    }
  }

  // ---------- Export PDF ----------
  async function handleExportPdf() {
    if (exporting) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/export/cover-letter-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content,
          job_title: letter.job_title ?? undefined,
          company_name: letter.company_name ?? undefined,
        }),
      });
      if (!res.ok) {
        setError({
          title: tt("errors.pdf_title"),
          body: tt("errors.pdf_body"),
        });
        return;
      }
      const blob = await res.blob();
      const filename =
        res.headers
          .get("content-disposition")
          ?.match(/filename="?([^"]+)"?/)?.[1] ?? "cover-letter.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(tt("actions.pdf_success"));
    } catch {
      setError({
        title: tt("errors.pdf_title"),
        body: tt("errors.network_body"),
      });
    } finally {
      setExporting(false);
    }
  }

  // ---------- Delete ----------
  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      window.setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    startDelete(async () => {
      const result = await deleteCoverLetterAction(letter.id);
      if (!result.ok) {
        setError({ title: tt("errors.delete_title"), body: result.error });
        setConfirmDelete(false);
        return;
      }
      router.push("/cover-letters");
      router.refresh();
    });
  }

  // ---------- Transform (improve / shorten / tone) ----------
  async function handleTransform(mode: TransformMode) {
    if (busy) return;
    setError(null);
    setActiveTransform(mode);
    try {
      const payload: {
        text: string;
        mode: "improve" | "shorten";
        tone?: ToneVariant;
      } = {
        text: content,
        mode: mode === "shorten" ? "shorten" : "improve",
      };
      if (TONE_VARIANTS.includes(mode as ToneVariant)) {
        payload.tone = mode as ToneVariant;
      }
      const res = await fetch("/api/ai/improve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        text?: string;
        message?: string;
      };
      if (!res.ok || !data.text) {
        setError({
          title: tt("errors.ai_failed_title"),
          body: data.message ?? tt("errors.ai_failed_body"),
        });
        return;
      }
      setContent(data.text);
    } catch {
      setError({
        title: tt("errors.network_title"),
        body: tt("errors.network_body"),
      });
    } finally {
      setActiveTransform(null);
    }
  }

  // ---------- Translate ----------
  async function handleTranslate(target: OutputLanguage) {
    if (busy || target === language) return;
    setError(null);
    setTranslating(target);
    try {
      const preserveTerms: string[] = [];
      if (letter.company_name) preserveTerms.push(letter.company_name);
      if (letter.job_title) preserveTerms.push(letter.job_title);
      for (const sig of letter.job_research?.useful_signals ?? []) {
        if (sig && sig.length <= 60) preserveTerms.push(sig);
      }
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: content,
          targetLanguage: target,
          preserveTerms,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        translatedText?: string;
        message?: string;
      };
      if (!res.ok || !data.translatedText) {
        setError({
          title: tt("errors.ai_failed_title"),
          body: data.message ?? tt("errors.ai_failed_body"),
        });
        return;
      }
      setContent(data.translatedText);
      setLanguage(target);
      toast.success(
        tt("translation.toast_translated", {
          target: tt(`language.${target.toLowerCase()}`),
        }),
      );
    } catch {
      setError({
        title: tt("errors.network_title"),
        body: tt("errors.network_body"),
      });
    } finally {
      setTranslating(null);
    }
  }

  // ---------- Regenerate from original job context ----------
  async function handleRegenerate() {
    if (busy || !canRegenerate(letter)) return;
    setError(null);
    setRegenerating(true);
    try {
      const jobDescription =
        letter.job_description?.trim().length
          ? letter.job_description
          : letter.job_research
            ? researchToJobDescription(letter.job_research)
            : null;
      if (!jobDescription) return;
      const channel = letter.channel ?? "platform";
      const recipientName = letter.recipient_name ?? undefined;
      const baseBody =
        letter.job_research != null
          ? {
              jobDescription,
              jobResearch: letter.job_research,
              targetLanguage: language ?? "English",
            }
          : {
              jobDescription,
              targetLanguage: language ?? "English",
            };
      const body = {
        ...baseBody,
        channel,
        ...(channel === "direct" && recipientName
          ? { recipientName }
          : {}),
      };
      const res = await fetch("/api/ai/cover-letter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        text?: string;
        language?: string;
        message?: string;
      };
      if (!res.ok || !data.text) {
        setError({
          title: tt("errors.ai_failed_title"),
          body: data.message ?? tt("errors.ai_failed_body"),
        });
        return;
      }
      setContent(data.text);
      if (
        data.language === "English" ||
        data.language === "Russian" ||
        data.language === "Armenian"
      ) {
        setLanguage(data.language);
      }
    } catch {
      setError({
        title: tt("errors.network_title"),
        body: tt("errors.network_body"),
      });
    } finally {
      setRegenerating(false);
    }
  }

  const heading =
    [letter.job_title, letter.company_name].filter(Boolean).join(" · ") ||
    tt("library.untitled");
  const updatedAt = letter.updated_at ?? letter.created_at;

  return (
    <div className="mt-4 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-h1 tracking-tight">{heading}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-small text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" />
              {tt("detail.last_edited", { when: formatDate(updatedAt) })}
            </span>
            {language && (
              <>
                <span className="text-border">·</span>
                <span className="inline-flex items-center gap-1">
                  <Languages className="h-3.5 w-3.5" />
                  {tt(`language.${language.toLowerCase()}`)}
                </span>
              </>
            )}
            {letter.source_type && (
              <>
                <span className="text-border">·</span>
                <span className="inline-flex items-center gap-1">
                  {letter.source_type === "job_link" ? (
                    <Globe className="h-3.5 w-3.5" />
                  ) : (
                    <PencilLine className="h-3.5 w-3.5" />
                  )}
                  {letter.source_type === "job_link"
                    ? tt("library.source_job_link")
                    : tt("library.source_manual")}
                </span>
              </>
            )}
            {letter.source_url && (
              <>
                <span className="text-border">·</span>
                <a
                  href={letter.source_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="truncate text-primary hover:underline"
                >
                  {letter.source_url}
                </a>
              </>
            )}
            {letter.channel === "direct" && (
              <>
                <span className="text-border">·</span>
                <span className="inline-flex items-center gap-1">
                  {tt("channel.direct")}
                  {letter.recipient_name && (
                    <span className="text-secondary-foreground">
                      → {letter.recipient_name}
                    </span>
                  )}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleCopy}
            disabled={busy}
          >
            <Copy className="h-4 w-4" />
            {tt("actions.copy")}
          </Button>
          <Button
            variant="outline"
            onClick={() => void run(handleExportPdf)}
            disabled={busy}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {tt("actions.export_pdf")}
          </Button>
          <Button
            onClick={() => void run(async () => handleSave())}
            disabled={!dirty || busy}
          >
            {savingPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {tt("detail.save_changes")}
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <div className="text-small font-medium text-foreground">
              {error.title}
            </div>
            <p className="pt-0.5 text-small text-muted-foreground">
              {error.body}
            </p>
          </div>
        </div>
      )}

      {/* Editor */}
      <section className="rounded-2xl border border-border bg-surface p-1.5">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={busy}
          className="min-h-[480px] resize-none border-0 bg-transparent px-5 py-4 text-body leading-7 tracking-[0.005em] focus-visible:ring-0"
          placeholder={
            translating
              ? tt("translation.translating", {
                  target: tt(`language.${translating.toLowerCase()}`),
                })
              : undefined
          }
        />
      </section>

      {/* Refinement actions */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {canRegenerate(letter) && (
            <Button
              variant="outline"
              onClick={() => void run(handleRegenerate)}
              disabled={busy}
            >
              {regenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {tt("buttons.regenerate")}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => void run(() => handleTransform("stronger"))}
            disabled={busy}
          >
            {activeTransform === "stronger" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {tt("buttons.make_stronger")}
          </Button>
          <Button
            variant="outline"
            onClick={() => void run(() => handleTransform("shorten"))}
            disabled={busy}
          >
            {activeTransform === "shorten" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Scissors className="h-4 w-4" />
            )}
            {tt("buttons.make_shorter")}
          </Button>
          <MoreMenu
            onSelect={(tone) => void run(() => handleTransform(tone))}
            disabled={busy}
            label={tt("buttons.more")}
            items={TONE_VARIANTS.map((key) => ({
              key,
              label: tt(`more_menu.${key}`),
              description: tt(`more_menu.${key}_desc`),
            }))}
            busyVariant={
              activeTransform &&
              TONE_VARIANTS.includes(activeTransform as ToneVariant)
                ? (activeTransform as ToneVariant)
                : null
            }
          />
          <TranslateMenu
            currentLanguage={language}
            translating={translating}
            onSelect={(target) => void run(() => handleTranslate(target))}
            disabled={busy}
            t={tt}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => void run(async () => handleDelete())}
          disabled={busy}
          className={cn(
            confirmDelete &&
              "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15",
          )}
        >
          {deletingPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {confirmDelete ? tt("actions.delete_confirm") : tt("actions.delete")}
        </Button>
      </section>
    </div>
  );
}

function TranslateMenu({
  currentLanguage,
  translating,
  onSelect,
  disabled,
  t,
}: {
  currentLanguage: OutputLanguage | null;
  translating: OutputLanguage | null;
  onSelect: (target: OutputLanguage) => void;
  disabled?: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
        >
          {translating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Languages className="h-4 w-4" />
          )}
          {t("translation.translate")}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            "z-50 min-w-[200px] overflow-hidden rounded-lg border border-border bg-surface-elevated p-1 shadow-lg shadow-black/30",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1",
          )}
        >
          {OUTPUT_LANGUAGES.map((lang) => {
            const isCurrent = currentLanguage === lang;
            const isBusy = translating === lang;
            return (
              <DropdownMenu.Item
                key={lang}
                onSelect={() => onSelect(lang)}
                disabled={isCurrent || translating != null}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-small outline-none transition-colors",
                  "focus:bg-surface focus:text-foreground",
                  "data-[disabled]:pointer-events-none data-[disabled]:opacity-60",
                )}
              >
                <span className="text-foreground">
                  {t(`translation.to_${lang.toLowerCase()}`)}
                </span>
                <span className="ml-2 inline-flex h-3.5 w-3.5 items-center justify-center text-muted-foreground">
                  {isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isCurrent ? (
                    <span
                      className="text-primary"
                      title={t("translation.current_language")}
                    >
                      ●
                    </span>
                  ) : null}
                </span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function canRegenerate(letter: LetterDetail): boolean {
  return Boolean(
    (letter.job_description && letter.job_description.trim().length > 0) ||
      letter.job_research,
  );
}

function researchToJobDescription(r: JobResearch): string {
  const parts: string[] = [];
  if (r.job_title || r.company_name) {
    parts.push(
      `${r.job_title || "Role"} at ${r.company_name || "the company"}`,
    );
  }
  if (r.job_summary) parts.push(r.job_summary);
  if (r.responsibilities) {
    parts.push(`Responsibilities:\n${r.responsibilities}`);
  }
  if (r.requirements) parts.push(`Requirements:\n${r.requirements}`);
  if (r.company_context) {
    parts.push(`About the company: ${r.company_context}`);
  }
  if (r.product_context) parts.push(`Product: ${r.product_context}`);
  return parts.join("\n\n");
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
