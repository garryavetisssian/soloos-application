"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Languages,
  Link2,
  Loader2,
  PencilLine,
  Plus,
  RefreshCw,
  Scissors,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n, useT } from "@/lib/i18n/hooks";
import {
  OUTPUT_LANGUAGES,
  localeToOutputLanguage,
  type OutputLanguage,
} from "@/lib/i18n/types";
import { detectJobLanguage } from "@/lib/language-detect";
import type { JobResearch } from "@/lib/job-research/types";
import { cn } from "@/lib/utils";
import {
  JobResearchCard,
  type JobResearchState,
} from "./job-research-card";
import { useActionLock } from "@/lib/ui/action-lock";
import { useToast } from "@/lib/ui/toast";
import { MoreMenu, type ToneVariant } from "./more-menu";
import { saveCoverLetterAction } from "./actions";

const JOB_DESCRIPTION_MAX = 8000;

type Mode = "url" | "manual";
type TransformMode = "shorten" | "stronger" | ToneVariant;
type LastAction =
  | { kind: "generate" }
  | { kind: "transform"; mode: TransformMode }
  | null;
type ErrorState = { title: string; body: string } | null;

// Metadata for the generated letter card. We separate three things on
// purpose because they are *not* the same:
//   - originalLanguage: language the letter was first generated in
//     (driven by outputLanguage at generate-time, never by uiLanguage).
//   - sourceLanguage: language of the underlying job description / page,
//     captured from the input and stable across UI/output changes.
//   - translatedTo: present only after the user uses the in-card Translate
//     dropdown — the letter on screen now reads in this language, but the
//     source job language and original generation language are unchanged.
interface GeneratedMeta {
  originalLanguage: OutputLanguage;
  sourceLanguage: OutputLanguage;
  basis: "research" | "description";
  at: number;
  translatedTo: OutputLanguage | null;
}

const TONE_VARIANTS: ReadonlyArray<ToneVariant> = [
  "confident",
  "friendly",
  "formal",
  "startup",
];

// A link the user can choose to include in the letter: their profile
// Portfolio URL plus each eligible portfolio/project link.
export interface SelectableLink {
  url: string;
  label: string;
  kind: "profile" | "work";
}

// Append new Q&A onto existing ones, skipping any question already present
// (case-insensitive) so the answers list stacks without duplicates.
function mergeAnswers(
  prev: Array<{ question: string; answer: string }>,
  additions: Array<{ question: string; answer: string }>,
): Array<{ question: string; answer: string }> {
  const seen = new Set(prev.map((a) => a.question.trim().toLowerCase()));
  const add = additions.filter(
    (a) =>
      a.question?.trim() &&
      a.answer?.trim() &&
      !seen.has(a.question.trim().toLowerCase()),
  );
  return add.length ? [...prev, ...add] : prev;
}

interface Props {
  completeness: number;
  availableLinks: SelectableLink[];
}

export function CoverLetterForm({
  completeness: _completeness,
  availableLinks,
}: Props) {
  const [mode, setMode] = useState<Mode>("url");

  // URL mode
  const [jobUrl, setJobUrl] = useState("");
  const [researchState, setResearchState] = useState<JobResearchState>({
    kind: "idle",
  });

  // Manual mode
  const [jobDescription, setJobDescription] = useState("");

  // Output
  const [generated, setGenerated] = useState("");
  const [generating, setGenerating] = useState(false);
  const [activeTransform, setActiveTransform] = useState<TransformMode | null>(
    null,
  );
  const [error, setError] = useState<ErrorState>(null);
  const [lastAction, setLastAction] = useState<LastAction>(null);

  // Output metadata + save / export state
  const [meta, setMeta] = useState<GeneratedMeta | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savingLetter, setSavingLetter] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const { toast } = useToast();
  const { run, isLocked } = useActionLock();

  // In-card translation state. Independent of generation: translating just
  // re-renders the existing letter; sourceLanguage / originalLanguage on
  // `meta` are intentionally NOT touched.
  const [translating, setTranslating] = useState<OutputLanguage | null>(null);

  // Channel — where the letter is going. "platform" is the formal cover
  // letter (LinkedIn/HH/Indeed/company careers page); "direct" is a
  // humanized DM the user pastes into LinkedIn, Telegram, or email.
  const [channel, setChannel] = useState<"platform" | "direct">("platform");

  // Optional recipient name for direct messages. Two sources, in priority
  // order: (1) explicit user input — `recipientOverride`; (2) auto-filled
  // from research.recruiter_name once the page is analyzed. We track the
  // override and the auto-fill separately so the user can clear the
  // suggested name without us re-populating it on every re-render.
  const [recipientOverride, setRecipientOverride] = useState<string | null>(
    null,
  );

  // Re-normalization state for when the user switches output language after
  // a job link has been analyzed. We keep showing the existing research and
  // overlay a "Translating to X…" status; on success we replace the research
  // with the normalized version, on failure we surface a soft error banner
  // (the previous research stays visible — never blanked out).
  const [normalizing, setNormalizing] = useState<OutputLanguage | null>(null);
  const [normalizeError, setNormalizeError] = useState<ErrorState>(null);

  // Which links the letter may reference. null = "auto": the AI includes a
  // link only when it genuinely fits the role (never forced). An array =
  // explicit: include exactly these URLs (the user hand-picked them via the
  // selector), which may include the profile Portfolio URL.
  const [linkSelection, setLinkSelection] = useState<string[] | null>(null);

  // Screening / application questions (e.g. Upwork) the server extracted from
  // the job + answered, shown below the letter. `answersCombined` flips once
  // the user merges them into the letter so the panel collapses.
  const [answers, setAnswers] = useState<
    Array<{ question: string; answer: string }>
  >([]);
  const [answersCombined, setAnswersCombined] = useState(false);
  // Manual questions the user pastes for this vacancy (one per line).
  const [manualQuestions, setManualQuestions] = useState("");
  const [answeringQuestions, setAnsweringQuestions] = useState(false);

  // i18n
  const t = useT();
  const tt = (key: string, vars?: Record<string, string | number>) =>
    t(`cover_letter.${key}`, vars);
  const { locale } = useI18n();

  // Output language override: explicit user choice from the dropdown.
  // We resolve the *effective* outputLanguage below, after sourceLanguage
  // is computed, so the natural default is the language of the job content
  // itself — pasting a Russian JD should pre-select "Russian" without any
  // user action, and the smart-suggestion banner shouldn't fire for the
  // obvious case.
  const [outputLanguageOverride, setOutputLanguageOverride] = useState<
    OutputLanguage | null
  >(null);

  // Derived
  const research =
    researchState.kind === "ready" ? researchState.research : null;
  const hasGenerated = generated.trim().length > 0;
  const busy =
    generating ||
    activeTransform != null ||
    translating != null ||
    answeringQuestions ||
    isLocked;

  // sourceLanguage — language of the *original* job content. Critical: this
  // must NOT change when uiLanguage / outputLanguage changes, otherwise the
  // smart suggestion will say nonsense like "this Russian job is in
  // Armenian, want it in Armenian?" after the user toggles the output
  // dropdown. We derive it strictly from inputs that never get translated:
  //   - Manual mode: the raw user-pasted text. The user can't paste in a
  //     "translated" version of itself, so detectJobLanguage on it is safe.
  //   - URL mode: research.source_language, captured by the API from the
  //     raw page text before normalization. normalizeJobResearch preserves
  //     this field across re-translations, so it stays stable forever once
  //     the page has been analyzed.
  // We DO NOT derive it from researchToJobDescription(research) — those
  // fields get translated into the current outputLanguage on every
  // re-normalization, which is the original bug.
  const sourceLanguage: OutputLanguage | null = useMemo(() => {
    if (mode === "manual") {
      const trimmed = jobDescription.trim();
      return trimmed.length > 0 ? detectJobLanguage(trimmed) : null;
    }
    return research ? research.source_language : null;
  }, [mode, jobDescription, research]);

  // Effective output / display language. Resolution order:
  //   1. Explicit user choice from the dropdown — wins forever once set.
  //   2. The UI locale — so research, tags, and the letter are shown and
  //      written in the language the user is using the app in. Switching
  //      the interface language follows here and re-translates the research.
  // The detected source language is kept separately (sourceLanguage) for
  // the "Source language" label and the smart-suggestion banner, which now
  // offers "this job is in Russian — generate in Russian?" when the job
  // language differs from the UI language.
  const outputLanguage: OutputLanguage =
    outputLanguageOverride ?? localeToOutputLanguage(locale);

  const hasJobInput =
    mode === "manual" ? jobDescription.trim().length > 0 : research != null;
  const canGenerate =
    mode === "manual"
      ? jobDescription.trim().length > 0 && !busy
      : research != null && !busy;

  // Track the *identity* of the input that produced the currently-shown
  // letter. When the user edits the job description / pastes a new URL /
  // re-analyzes a different link, the previous letter is stale — the
  // primary CTA flips from "Regenerate" back to "Generate" to communicate
  // that the next click produces a fresh letter for the new input.
  //
  // Output-language changes deliberately do NOT count as an input change
  // (re-normalization translates the *same* job into a new display
  // language; semantically the job is unchanged). We key on the source
  // URL for URL mode and the trimmed text for manual mode.
  const currentInputKey =
    mode === "url"
      ? `url:${research?.url ?? ""}`
      : `manual:${jobDescription.trim()}`;
  const [lastGenerationKey, setLastGenerationKey] = useState<string | null>(
    null,
  );
  const inputChangedSinceGeneration =
    hasGenerated &&
    lastGenerationKey !== null &&
    currentInputKey !== lastGenerationKey;
  // The label/icon used by both the primary CTA (left card) and the
  // inline "Regenerate" action button (right card) is the same — derive
  // once so the two stay in sync.
  const showAsRegenerate = hasGenerated && !inputChangedSinceGeneration;

  // Screening-answer editing + merging the answers into the letter.
  const updateAnswer = (i: number, value: string) =>
    setAnswers((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, answer: value } : a)),
    );
  const removeAnswer = (i: number) =>
    setAnswers((prev) => prev.filter((_, idx) => idx !== i));
  const combineAnswersIntoLetter = () => {
    if (answers.length === 0) return;
    const qa = answers
      .map((a, i) => `${i + 1}. ${a.question}\n${a.answer}`)
      .join("\n\n");
    setGenerated((cur) => `${cur.trim()}\n\n—\n\n${tt("answers.heading")}\n\n${qa}`);
    setAnswersCombined(true);
    // Merging edits the letter — invalidate any saved copy.
    if (savedAt) {
      setSavedAt(null);
      setSavedId(null);
    }
  };

  // Answer the questions the user pasted, matched to their profile + this
  // vacancy. Works independently of generating a letter (handy when a link
  // blocks reading and the user pastes questions by hand).
  async function handleAnswerQuestions() {
    const questions = manualQuestions
      .split("\n")
      .map((q) => q.replace(/^\s*\d+[.)]\s*/, "").trim())
      .filter(Boolean);
    if (questions.length === 0) return;
    setAnsweringQuestions(true);
    setError(null);
    try {
      const jobText =
        mode === "url" && research
          ? researchToJobDescription(research)
          : jobDescription;
      const res = await fetch("/api/ai/screening-answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questions,
          jobDescription: jobText ? jobText.slice(0, 8000) : undefined,
          targetLanguage: outputLanguage,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        answers?: Array<{ question: string; answer: string }>;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(buildAiError(res.status, data, tt));
        return;
      }
      // Stack new answers onto the existing ones (dedupe by question) so
      // answering another question never erases the earlier ones.
      const incoming = Array.isArray(data.answers) ? data.answers : [];
      setAnswers((prev) => mergeAnswers(prev, incoming));
      // Clear the input so the next question starts fresh.
      if (incoming.length > 0) setManualQuestions("");
      setAnswersCombined(false);
    } catch {
      setError({
        title: tt("errors.network_title"),
        body: tt("errors.network_body"),
      });
    } finally {
      setAnsweringQuestions(false);
    }
  }

  // Effective recipient name for the prompt. Explicit user input (even an
  // empty string deliberately cleared) wins over the auto-detected name
  // from the analyzed page. Only used when channel === "direct".
  const detectedRecipient = research?.recruiter_name?.trim() ?? "";
  const recipientName: string =
    recipientOverride !== null ? recipientOverride : detectedRecipient;

  // ---------- Mode swapping ----------
  function chooseMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setError(null);
  }

  // ---------- URL analysis ----------
  async function handleAnalyze() {
    const url = jobUrl.trim();
    if (!url || researchState.kind === "analyzing") return;
    setError(null);
    setNormalizeError(null);
    setResearchState({ kind: "analyzing", url });
    try {
      const res = await fetch("/api/ai/job-research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Always emit the research in the effective display language (the
        // dropdown override, else the UI locale). A Russian job opened in
        // an English UI comes back already translated to English — summary,
        // company/product context, responsibilities, requirements, and the
        // signal tags. source_language is still detected server-side for
        // the "Source language" label.
        body: JSON.stringify({
          url,
          targetLanguage: outputLanguageOverride ?? localeToOutputLanguage(locale),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as
        | (JobResearch & { is_job_page: true })
        | { error?: string; message?: string; subtext?: string };
      if (!res.ok || !("is_job_page" in data) || !data.is_job_page) {
        const failureData = data as {
          message?: string;
          subtext?: string;
        };
        setResearchState({
          kind: "failed",
          title:
            failureData.message ?? tt("research.failure_default_title"),
          subtext:
            failureData.subtext ?? tt("research.failure_default_subtext"),
        });
        return;
      }
      setResearchState({ kind: "ready", research: data as JobResearch });
    } catch {
      setResearchState({
        kind: "failed",
        title: tt("research.failure_network_title"),
        subtext: tt("research.failure_network_subtext"),
      });
    }
  }

  function handleResetResearch() {
    setResearchState({ kind: "idle" });
    setNormalizeError(null);
  }
  function handleFailedSwitchToManual() {
    setResearchState({ kind: "idle" });
    setNormalizeError(null);
    chooseMode("manual");
  }

  // ---------- Language-switch re-normalization ----------
  // When the user changes the output language after a successful job-link
  // analysis, the existing research (which is in the previous language)
  // would otherwise stay on screen — exactly the mixed-language UX we're
  // fixing. We send the cached research to /api/ai/normalize-research and
  // replace it with the version in the new language. If translation fails,
  // we surface a soft banner; the (stale-by-language) research stays visible
  // so the user can still choose to re-analyze or paste manually.
  //
  // We track the in-flight target with a ref so a fast double-toggle
  // (EN → RU → EN) doesn't apply a stale response to the wrong target.
  const normalizingTargetRef = useRef<OutputLanguage | null>(null);

  useEffect(() => {
    if (researchState.kind !== "ready") return;
    const current = researchState.research;
    if (current.output_language === outputLanguage) return;
    // Already chasing this target — let the in-flight request finish.
    if (normalizingTargetRef.current === outputLanguage) return;

    normalizingTargetRef.current = outputLanguage;
    setNormalizing(outputLanguage);
    setNormalizeError(null);

    (async () => {
      try {
        const res = await fetch("/api/ai/normalize-research", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            research: current,
            targetLanguage: outputLanguage,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          research?: JobResearch;
          error?: string;
          message?: string;
        };
        // The user may have switched languages again while we were waiting.
        if (normalizingTargetRef.current !== outputLanguage) return;
        if (!res.ok || !data.research) {
          setNormalizeError({
            title: tt("research.translation_failed_title"),
            body: tt("research.translation_failed_body"),
          });
          return;
        }
        setResearchState({ kind: "ready", research: data.research });
      } catch {
        if (normalizingTargetRef.current !== outputLanguage) return;
        setNormalizeError({
          title: tt("research.translation_failed_title"),
          body: tt("research.translation_failed_body"),
        });
      } finally {
        if (normalizingTargetRef.current === outputLanguage) {
          normalizingTargetRef.current = null;
          setNormalizing(null);
        }
      }
    })();
    // tt is recreated every render but is referentially stable behavior-wise;
    // including outputLanguage + the research identity is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputLanguage, researchState]);

  // ---------- Cover letter generation ----------
  async function handleGenerate() {
    if (!canGenerate) return;
    setError(null);
    setGenerating(true);
    setLastAction({ kind: "generate" });
    try {
      const baseBody =
        mode === "url" && research
          ? {
              jobDescription: researchToJobDescription(research),
              jobResearch: research,
              targetLanguage: outputLanguage,
            }
          : { jobDescription, targetLanguage: outputLanguage };
      const body = {
        ...baseBody,
        channel,
        // Only forward recipientName when the direct channel is selected
        // — the server prompt ignores it otherwise, and not sending it
        // keeps logs cleaner.
        ...(channel === "direct" && recipientName
          ? { recipientName }
          : {}),
        // Forward an explicit link selection only when the user customized
        // it. Omitted = auto (AI includes relevant links, never forced).
        ...(linkSelection !== null
          ? { includeLinkUrls: linkSelection }
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
        answers?: Array<{ question: string; answer: string }>;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(buildAiError(res.status, data, tt));
        return;
      }
      setGenerated(data.text ?? "");
      // Auto-extracted answers stack onto any the user already has (dedupe by
      // question) — regenerating never wipes manually-added answers.
      const autoAnswers = Array.isArray(data.answers) ? data.answers : [];
      if (autoAnswers.length > 0) {
        setAnswers((prev) => mergeAnswers(prev, autoAnswers));
        setAnswersCombined(false);
      }
      // Server echoes back which language it actually wrote in. We trust
      // its response over the local `outputLanguage` so the meta strip
      // never disagrees with the letter on screen.
      const generatedIn = isOutputLanguage(data.language)
        ? data.language
        : outputLanguage;
      setMeta({
        originalLanguage: generatedIn,
        // sourceLanguage may be null only when there's no input at all —
        // by the time we reach here the user has clearly provided one,
        // but fall back defensively to the generated language to avoid
        // showing a blank "Source language: " row.
        sourceLanguage: sourceLanguage ?? generatedIn,
        basis: mode === "url" && research ? "research" : "description",
        at: Date.now(),
        translatedTo: null,
      });
      // A fresh generation invalidates any prior "Saved" state.
      setSavedAt(null);
      setSavedId(null);
      // Remember the input identity that produced this letter so the
      // CTA can flip back to "Generate" the moment the user edits it.
      setLastGenerationKey(currentInputKey);
    } catch {
      setError({
        title: tt("errors.network_title"),
        body: tt("errors.network_body"),
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleTransform(transformMode: TransformMode) {
    if (!hasGenerated || busy) return;
    setError(null);
    setActiveTransform(transformMode);
    setLastAction({ kind: "transform", mode: transformMode });
    try {
      // Map UI transform → API (mode + optional tone). "shorten" → mode=shorten.
      // "stronger" → mode=improve (default tone). Tone variants → mode=improve+tone.
      const payload: { text: string; mode: "improve" | "shorten"; tone?: ToneVariant } = {
        text: generated,
        mode: transformMode === "shorten" ? "shorten" : "improve",
      };
      if (TONE_VARIANTS.includes(transformMode as ToneVariant)) {
        payload.tone = transformMode as ToneVariant;
      }
      const res = await fetch("/api/ai/improve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(buildAiError(res.status, data, tt));
        return;
      }
      if (data.text) {
        setGenerated(data.text);
        // Refine actions (improve/shorten/tone) keep the same language —
        // they don't touch sourceLanguage / originalLanguage / translatedTo.
        if (meta) setMeta({ ...meta, at: Date.now() });
        setSavedAt(null);
        setSavedId(null);
      }
    } catch {
      setError({
        title: tt("errors.network_title"),
        body: tt("errors.network_body"),
      });
    } finally {
      setActiveTransform(null);
    }
  }

  // ---------- Translate generated letter ----------
  // Re-renders the letter on screen in `target`. Distinct from regenerate:
  // we don't re-prompt the model with the job description, we just
  // translate the existing prose. Source and original-generation language
  // on `meta` are intentionally preserved so the UI's history is honest.
  async function handleTranslate(target: OutputLanguage) {
    if (!hasGenerated || busy) return;
    // No-op when the letter is already in the target language. We treat
    // both the original-generation language and the most recent translation
    // as "current" — the dropdown also visually marks the current entry.
    const currentLanguage = meta?.translatedTo ?? meta?.originalLanguage;
    if (currentLanguage === target) return;
    setError(null);
    setTranslating(target);
    try {
      const preserveTerms: string[] = [];
      if (research?.company_name) preserveTerms.push(research.company_name);
      if (research?.job_title) preserveTerms.push(research.job_title);
      if (research?.product_context) {
        // useful_signals are tokens (often product/tool names). We don't
        // forward product_context prose itself — only the proper-noun-ish
        // useful_signals — to avoid bloating the preserve list.
      }
      for (const sig of research?.useful_signals ?? []) {
        if (sig && sig.length <= 60) preserveTerms.push(sig);
      }
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: generated,
          targetLanguage: target,
          preserveTerms,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        translatedText?: string;
        targetLanguage?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.translatedText) {
        setError(buildAiError(res.status, data, tt));
        return;
      }
      setGenerated(data.translatedText);
      if (meta) {
        setMeta({
          ...meta,
          // Source language NEVER changes here. Original generation
          // language NEVER changes here. Only translatedTo is updated.
          translatedTo: target,
          at: Date.now(),
        });
      }
      // Translated text differs from any saved DB copy — invalidate.
      setSavedAt(null);
      setSavedId(null);
      toast.success(
        t("cover_letter.translation.toast_translated", {
          target: t(`cover_letter.language.${target.toLowerCase()}`),
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

  async function handleCopy() {
    if (!hasGenerated) return;
    try {
      await navigator.clipboard.writeText(generated);
      toast.success(t("common.toast.copied"));
    } catch {
      setError({
        title: tt("errors.copy_title"),
        body: tt("errors.copy_body"),
      });
    }
  }

  async function handleSave() {
    if (!hasGenerated || savingLetter) return;
    setSavingLetter(true);
    setError(null);
    try {
      // Persist the full context the saved letter was generated from so the
      // detail page can offer Regenerate / Make stronger / etc against the
      // same source. Translation may have changed `meta.translatedTo`, but
      // we always store `originalLanguage` as the canonical letter language.
      const result = await saveCoverLetterAction({
        content: generated,
        job_title: research?.job_title,
        company_name: research?.company_name,
        language: meta?.translatedTo ?? meta?.originalLanguage ?? outputLanguage,
        source_type: mode === "url" ? "job_link" : "manual",
        source_url: mode === "url" ? jobUrl.trim() || undefined : undefined,
        job_description:
          mode === "manual" ? jobDescription : undefined,
        job_research: research,
        channel,
        // Persist the actual name used at generate time so Regenerate
        // from the detail page reproduces the same opener.
        recipient_name:
          channel === "direct" ? recipientName || undefined : undefined,
      });
      if (!result.ok) {
        setError({ title: tt("errors.save_title"), body: result.error });
        return;
      }
      setSavedAt(Date.now());
      setSavedId(result.id);
      toast.success(t("common.toast.saved_letter"));
    } finally {
      setSavingLetter(false);
    }
  }

  async function handleExportPdf() {
    if (!hasGenerated || exportingPdf) return;
    setExportingPdf(true);
    setError(null);
    try {
      const res = await fetch("/api/export/cover-letter-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: generated,
          job_title: research?.job_title,
          company_name: research?.company_name,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setError({
          title: tt("errors.pdf_title"),
          body: data.message ?? tt("errors.pdf_body"),
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
      toast.success(t("common.toast.pdf_downloaded"));
    } catch {
      setError({
        title: tt("errors.pdf_title"),
        body: tt("errors.network_body"),
      });
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleRetry() {
    if (!lastAction) return;
    if (lastAction.kind === "generate") {
      await handleGenerate();
    } else {
      await handleTransform(lastAction.mode);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ----------- Left: Job description ----------- */}
      <Card>
        <CardHeader
          title={tt("left_card.title")}
          subtitle={
            mode === "url"
              ? tt("left_card.subtitle_url")
              : tt("left_card.subtitle_manual")
          }
        />
        {/* Mode tabs are pure UI state — never gate them on isLocked.
            Only disable while a local cover-letter action is in flight
            (generate / transform / translate). Otherwise the user can
            always switch between paste-link and paste-description. */}
        <ModeSelector
          value={mode}
          onChange={chooseMode}
          disabled={
            generating || activeTransform != null || translating != null
          }
        />

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
          {mode === "url" ? (
            <UrlMode
              url={jobUrl}
              onUrlChange={(v) => {
                setJobUrl(v);
                if (researchState.kind !== "idle")
                  setResearchState({ kind: "idle" });
              }}
              onAnalyze={() => void run(handleAnalyze)}
              state={researchState}
              busy={busy}
              normalizing={normalizing}
              normalizeError={normalizeError}
              onDismissNormalizeError={() => setNormalizeError(null)}
              onResetResearch={handleResetResearch}
              onSwitchToManual={handleFailedSwitchToManual}
            />
          ) : (
            <ManualMode
              value={jobDescription}
              onChange={setJobDescription}
              sourceLanguage={sourceLanguage}
              busy={busy}
            />
          )}
        </div>

        <div className="mt-5 shrink-0 space-y-3">
          <SetupPanel
            sourceLanguage={sourceLanguage}
            channel={channel}
            onChannelChange={setChannel}
            outputLanguage={outputLanguage}
            onOutputChange={(lang) => setOutputLanguageOverride(lang)}
            recipientName={recipientName}
            detectedRecipient={detectedRecipient}
            onRecipientChange={(next) => setRecipientOverride(next)}
            disabled={busy}
            t={tt}
          />
          <LinkSelector
            availableLinks={availableLinks}
            selection={linkSelection}
            onChange={setLinkSelection}
            disabled={busy}
            t={tt}
          />
          {sourceLanguage &&
            sourceLanguage !== outputLanguage &&
            hasJobInput && (
              <SmartSuggestion
                source={sourceLanguage}
                sourceLabel={tt(`language.${sourceLanguage.toLowerCase()}`)}
                t={tt}
                onAccept={() => {
                  setOutputLanguageOverride(sourceLanguage);
                }}
                disabled={busy}
              />
            )}
          <Button
            onClick={() => void run(handleGenerate)}
            disabled={!canGenerate}
            size="lg"
            className="w-full"
          >
            {generating ? (
              <>
                <Loader2 className="animate-spin" />
                {showAsRegenerate
                  ? tt("buttons.regenerating")
                  : tt("buttons.generating")}
              </>
            ) : showAsRegenerate ? (
              <>
                <RefreshCw className="h-4 w-4" />
                {tt("buttons.regenerate")}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {tt("buttons.generate")}
              </>
            )}
          </Button>
          {error && (
            <div className="pt-1">
              <ErrorCallout
                error={error}
                onTryAgain={
                  lastAction && !busy ? () => void run(handleRetry) : undefined
                }
                tryAgainLabel={tt("buttons.try_again")}
              />
            </div>
          )}
        </div>
      </Card>

      {/* ----------- Right: Generated cover letter ----------- */}
      <Card>
        <CardHeader
          title={tt("right_card.title")}
          subtitle={tt("right_card.subtitle")}
          actions={
            hasGenerated ? (
              <UtilityActions
                // Copy doesn't touch the server — left unlocked.
                onCopy={handleCopy}
                onSave={() => void run(handleSave)}
                onExportPdf={() => void run(handleExportPdf)}
                onTranslate={(target) => void run(() => handleTranslate(target))}
                saving={savingLetter}
                exporting={exportingPdf}
                savedAt={savedAt}
                translating={translating}
                currentLanguage={
                  meta?.translatedTo ?? meta?.originalLanguage ?? null
                }
                t={tt}
              />
            ) : null
          }
        />
        {hasGenerated && meta && (
          <MetaRow meta={meta} t={tt} key={meta.at} />
        )}
        <div className="flex min-h-0 flex-1 flex-col">
          {generating ? (
            // Staged progress while the server drafts + humanizes the letter.
            <GenerationProgress t={tt} />
          ) : hasGenerated ? (
            <Textarea
              value={generated}
              onChange={(e) => {
                setGenerated(e.target.value);
                // User edits invalidate "Saved to My Letters" — the saved
                // copy in the DB no longer matches the current draft.
                if (savedAt) {
                  setSavedAt(null);
                  setSavedId(null);
                }
              }}
              disabled={busy}
              className="h-full min-h-0 flex-1 resize-none border-border bg-surface-elevated px-5 py-4 text-body leading-7 tracking-[0.005em] focus-visible:ring-1 focus-visible:ring-primary/40"
              placeholder={
                translating
                  ? tt("translation.translating", {
                      target: tt(`language.${translating.toLowerCase()}`),
                    })
                  : undefined
              }
            />
          ) : (
            <EmptyState t={tt} />
          )}
        </div>

        {hasGenerated && (
          <div className="mt-5 flex shrink-0 flex-wrap items-center gap-2">
            <ActionButton
              label={
                generating
                  ? showAsRegenerate
                    ? tt("buttons.regenerating")
                    : tt("buttons.generating")
                  : showAsRegenerate
                    ? tt("buttons.regenerate")
                    : tt("buttons.generate")
              }
              icon={
                generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : showAsRegenerate ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )
              }
              onClick={() => void run(handleGenerate)}
              disabled={busy || !canGenerate}
            />
            <ActionButton
              label={
                activeTransform === "stronger"
                  ? tt("buttons.strengthening")
                  : tt("buttons.make_stronger")
              }
              icon={
                activeTransform === "stronger" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )
              }
              onClick={() => void run(() => handleTransform("stronger"))}
              disabled={busy}
            />
            <ActionButton
              label={
                activeTransform === "shorten"
                  ? tt("buttons.shortening")
                  : tt("buttons.make_shorter")
              }
              icon={
                activeTransform === "shorten" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Scissors className="h-4 w-4" />
                )
              }
              onClick={() => void run(() => handleTransform("shorten"))}
              disabled={busy}
            />
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
          </div>
        )}
      </Card>

      {/* ----------- Full-width: application questions ----------- */}
      {hasJobInput && (
        <div className="lg:col-span-2">
          <QuestionsPanel
            questionsText={manualQuestions}
            onQuestionsChange={setManualQuestions}
            onAnswer={() => void run(handleAnswerQuestions)}
            answering={answeringQuestions}
            answers={answers}
            onAnswerEdit={updateAnswer}
            onAnswerRemove={removeAnswer}
            onCombine={combineAnswersIntoLetter}
            combined={answersCombined}
            canCombine={hasGenerated}
            disabled={busy}
            t={tt}
          />
        </div>
      )}
    </div>
  );
}

// =============================================================
// Mode selector
// =============================================================

function ModeSelector({
  value,
  onChange,
  disabled,
}: {
  value: Mode;
  onChange: (next: Mode) => void;
  disabled: boolean;
}) {
  const t = useT();
  return (
    <div
      role="tablist"
      aria-label={t("cover_letter.left_card.title")}
      className="flex shrink-0 gap-1 rounded-lg border border-border bg-surface-elevated p-1"
    >
      <ModeTab
        active={value === "url"}
        onClick={() => onChange("url")}
        disabled={disabled}
        icon={<Link2 className="h-4 w-4" />}
        label={t("cover_letter.mode.url")}
        recommendedLabel={t("cover_letter.mode.recommended")}
        recommended
      />
      <ModeTab
        active={value === "manual"}
        onClick={() => onChange("manual")}
        disabled={disabled}
        icon={<PencilLine className="h-4 w-4" />}
        label={t("cover_letter.mode.manual")}
      />
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  disabled,
  icon,
  label,
  recommended,
  recommendedLabel,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  recommended?: boolean;
  recommendedLabel?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-small font-medium transition-colors",
        active
          ? "bg-surface text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className={cn(active ? "text-primary" : "")}>{icon}</span>
      <span>{label}</span>
      {recommended && (
        <span
          className={cn(
            "ml-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-label font-semibold leading-none",
            "bg-primary text-primary-foreground",
          )}
        >
          {recommendedLabel ?? "AI recommended"}
        </span>
      )}
    </button>
  );
}

// =============================================================
// URL mode
// =============================================================

function UrlMode({
  url,
  onUrlChange,
  onAnalyze,
  state,
  busy,
  normalizing,
  normalizeError,
  onDismissNormalizeError,
  onResetResearch,
  onSwitchToManual,
}: {
  url: string;
  onUrlChange: (v: string) => void;
  onAnalyze: () => void;
  state: JobResearchState;
  busy: boolean;
  normalizing: OutputLanguage | null;
  normalizeError: { title: string; body: string } | null;
  onDismissNormalizeError: () => void;
  onResetResearch: () => void;
  onSwitchToManual: () => void;
}) {
  const t = useT();
  const analyzing = state.kind === "analyzing";
  const canAnalyze = url.trim().length > 0 && !analyzing && !busy;
  return (
    <>
      <div className="flex shrink-0 items-stretch gap-2">
        <Input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canAnalyze) {
              e.preventDefault();
              onAnalyze();
            }
          }}
          placeholder={t("cover_letter.url_placeholder")}
          disabled={analyzing || busy}
          className="flex-1 bg-surface-elevated"
        />
        <Button
          variant="outline"
          onClick={onAnalyze}
          disabled={!canAnalyze}
          size="default"
        >
          {analyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("cover_letter.buttons.analyzing")}
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              {t("cover_letter.buttons.analyze")}
            </>
          )}
        </Button>
      </div>
      <p className="shrink-0 text-small text-muted-foreground">
        {t("cover_letter.url_helper")}
      </p>
      <JobResearchCard
        state={state}
        normalizing={normalizing}
        normalizeError={normalizeError}
        onDismissNormalizeError={onDismissNormalizeError}
        onTryAnotherLink={onResetResearch}
        onSwitchToManual={onSwitchToManual}
      />
    </>
  );
}

// =============================================================
// Manual mode
// =============================================================

function ManualMode({
  value,
  onChange,
  sourceLanguage,
  busy,
}: {
  value: string;
  onChange: (next: string) => void;
  sourceLanguage: OutputLanguage | null;
  busy: boolean;
}) {
  const t = useT();
  const tt = (key: string, vars?: Record<string, string | number>) =>
    t(`cover_letter.${key}`, vars);
  return (
    <>
      <p className="shrink-0 text-small text-muted-foreground">
        {tt("manual_tip")}
      </p>
      <Textarea
        maxLength={JOB_DESCRIPTION_MAX}
        placeholder={tt("manual_placeholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={busy}
        className="h-full min-h-0 flex-1 resize-none border-border bg-surface-elevated text-body"
      />
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-small text-muted-foreground">
        {sourceLanguage ? (
          <LanguageBadge language={sourceLanguage} t={tt} />
        ) : (
          <span />
        )}
        <span className="tabular-nums">
          {value.length.toLocaleString()} /{" "}
          {JOB_DESCRIPTION_MAX.toLocaleString()}
        </span>
      </div>
    </>
  );
}

// =============================================================
// Helpers
// =============================================================

function researchToJobDescription(r: JobResearch): string {
  const parts: string[] = [];
  if (r.job_title || r.company_name) {
    parts.push(
      `${r.job_title || "Role"} at ${r.company_name || "the company"}`,
    );
  }
  if (r.job_summary) parts.push(r.job_summary);
  if (r.responsibilities)
    parts.push(`Responsibilities:\n${r.responsibilities}`);
  if (r.requirements) parts.push(`Requirements:\n${r.requirements}`);
  if (r.company_context) parts.push(`About the company: ${r.company_context}`);
  if (r.product_context) parts.push(`Product: ${r.product_context}`);
  return parts.join("\n\n");
}

function buildAiError(
  status: number,
  data: { error?: string; message?: string },
  tt: (key: string, vars?: Record<string, string | number>) => string,
): { title: string; body: string } {
  if (status === 401) {
    return {
      title: tt("errors.sign_in_title"),
      body: tt("errors.sign_in_body"),
    };
  }
  const code = data.error;
  switch (code) {
    case "ai_unavailable":
      return {
        title: tt("errors.ai_unavailable_title"),
        body: data.message ?? tt("errors.ai_unavailable_body"),
      };
    case "rate_limited":
      return {
        title: tt("errors.rate_limited_title"),
        body: data.message ?? tt("errors.rate_limited_body"),
      };
    case "server_misconfigured":
    case "profile_required":
    case "profile_incomplete":
    case "profile_empty":
    case "invalid_body":
    default:
      return {
        title: tt("errors.ai_failed_title"),
        body: data.message ?? tt("errors.ai_failed_body"),
      };
  }
}

// =============================================================
// Bits
// =============================================================

function Card({ children }: { children: React.ReactNode }) {
  // Min-height (not fixed h-full) — the card grows with content so a long
  // Failed banner / Direct-mode SetupPanel can never push children to
  // overlap. The parent <main> in app/(app)/layout.tsx is the scrollable
  // viewport, so when both cards together exceed the screen the page
  // scrolls naturally. The min-height keeps the right card's textarea
  // comfortably tall on first paint.
  return (
    <section className="flex min-h-[640px] flex-col rounded-xl border border-border bg-surface p-6 shadow-sm">
      {children}
    </section>
  );
}

function CardHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="shrink-0 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h3 font-semibold tracking-[-0.01em] text-foreground">
            {title}
          </h2>
          <p className="pt-1 text-small text-muted-foreground">{subtitle}</p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {/* Hairline under the header to separate it from the body. */}
      <div className="mt-3 h-px bg-border" />
    </header>
  );
}

// Utility action bar (Copy / Save to My Letters / Export PDF / Translate)
// for the generated-cover-letter card. Subtle icon buttons with tooltip +
// a small "Saved" badge once the letter has been saved. The Translate
// dropdown is only mounted once a letter exists — no preemptive UI.
function UtilityActions({
  onCopy,
  onSave,
  onExportPdf,
  onTranslate,
  saving,
  exporting,
  savedAt,
  translating,
  currentLanguage,
  t,
}: {
  onCopy: () => void;
  onSave: () => void;
  onExportPdf: () => void;
  onTranslate: (target: OutputLanguage) => void;
  saving: boolean;
  exporting: boolean;
  savedAt: number | null;
  translating: OutputLanguage | null;
  currentLanguage: OutputLanguage | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex items-center gap-1">
      {savedAt && (
        <span
          className="mr-1 inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-small text-success"
          title={t("actions.saved_tooltip")}
        >
          <BookmarkCheck className="h-3 w-3" />
          {t("actions.saved")}
        </span>
      )}
      <IconButton title={t("actions.copy")} onClick={onCopy}>
        <Copy className="h-4 w-4" />
      </IconButton>
      <IconButton
        title={savedAt ? t("actions.save_tooltip_done") : t("actions.save")}
        onClick={onSave}
        disabled={saving || savedAt != null}
        active={savedAt != null}
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : savedAt ? (
          <BookmarkCheck className="h-4 w-4" />
        ) : (
          <Bookmark className="h-4 w-4" />
        )}
      </IconButton>
      <IconButton
        title={t("actions.export_pdf")}
        onClick={onExportPdf}
        disabled={exporting}
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </IconButton>
      <TranslateMenu
        onSelect={onTranslate}
        translating={translating}
        currentLanguage={currentLanguage}
        t={t}
      />
    </div>
  );
}

// Translate dropdown — opens the three OUTPUT_LANGUAGES, marks the current
// language with a check, and shows a spinner on the entry being translated
// to. Doesn't appear unless a letter exists (controlled by the parent
// rendering UtilityActions only when hasGenerated).
function TranslateMenu({
  onSelect,
  translating,
  currentLanguage,
  t,
}: {
  onSelect: (target: OutputLanguage) => void;
  translating: OutputLanguage | null;
  currentLanguage: OutputLanguage | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          title={t("translation.translate")}
          aria-label={t("translation.translate")}
          disabled={translating != null}
          className={cn(
            "ml-1 inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface-elevated px-2 text-small text-muted-foreground transition-colors",
            "hover:border-primary/40 hover:text-foreground",
            "data-[state=open]:border-primary/40 data-[state=open]:text-foreground",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {translating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Languages className="h-3.5 w-3.5" />
          )}
          <span>{t("translation.translate")}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            "z-50 min-w-[180px] overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-md",
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
                  "focus:bg-surface-elevated focus:text-foreground",
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

// Narrow runtime guard for the API's `language` echo.
function isOutputLanguage(v: unknown): v is OutputLanguage {
  return v === "English" || v === "Russian" || v === "Armenian";
}

function IconButton({
  title,
  onClick,
  disabled,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-surface-elevated hover:text-foreground active:scale-[0.97]",
        active && "text-success hover:text-success",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      {children}
    </button>
  );
}

function MetaRow({
  meta,
  t,
}: {
  meta: GeneratedMeta;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const localizedOriginal = t(
    `language.${meta.originalLanguage.toLowerCase()}`,
  );
  const localizedSource = t(`language.${meta.sourceLanguage.toLowerCase()}`);
  const localizedTranslated = meta.translatedTo
    ? t(`language.${meta.translatedTo.toLowerCase()}`)
    : null;
  const basis =
    meta.basis === "research"
      ? t("meta.based_on_research")
      : t("meta.based_on_description");
  return (
    <div className="-mt-1 mb-3 shrink-0 space-y-0.5 text-small text-muted-foreground">
      <div>
        {t("meta.generated_in")}{" "}
        <span className="text-secondary-foreground">{localizedOriginal}</span>
        {localizedTranslated && (
          <>
            <span className="mx-1.5 text-border">·</span>
            <span className="inline-flex items-center gap-1 text-primary">
              <Languages className="h-3 w-3" />
              {t("translation.translated_to", {
                target: localizedTranslated,
              })}
            </span>
          </>
        )}
        <span className="mx-1.5 text-border">·</span>
        {basis}
        <span className="mx-1.5 text-border">·</span>
        {formatRelativeTime(meta.at, t)}
      </div>
      <div>
        {t("meta.source_job_language")}{" "}
        <span className="text-secondary-foreground">{localizedSource}</span>
      </div>
    </div>
  );
}

function formatRelativeTime(
  at: number,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const diff = Date.now() - at;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return t("meta.just_now");
  if (m < 60) return t("meta.minutes_ago", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("meta.hours_ago", { count: h });
  return t("meta.days_ago", { count: Math.floor(h / 24) });
}

function LanguageBadge({
  language,
  t,
}: {
  language: OutputLanguage;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const localized = t(`language.${language.toLowerCase()}`);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-2.5 py-1 text-small"
      title={t("language.detected_tooltip")}
    >
      <span className="text-muted-foreground">{t("language.source")}</span>
      <span className="text-muted-foreground">·</span>
      <span className="font-medium text-foreground">{localized}</span>
    </span>
  );
}

function EmptyState({
  t,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface-elevated px-6 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-primary">
        <FileText className="h-5 w-5" />
      </span>
      <div>
        <div className="text-body text-foreground">
          {t("empty_state.title")}
        </div>
        <p className="pt-1 text-small text-muted-foreground">
          {t("empty_state.body")}
        </p>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 text-small text-foreground transition-colors",
        "hover:border-primary/40 hover:bg-surface-elevated/80",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-surface-elevated",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ErrorCallout({
  error,
  onTryAgain,
  tryAgainLabel,
}: {
  error: { title: string; body: string };
  onTryAgain?: () => void;
  tryAgainLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4"
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <AlertCircle className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-small font-medium text-foreground">
          {error.title}
        </div>
        <p className="pt-0.5 text-small text-muted-foreground">{error.body}</p>
        {onTryAgain && (
          <button
            type="button"
            onClick={onTryAgain}
            className="mt-2 inline-flex items-center gap-1.5 text-small font-medium text-primary hover:underline"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {tryAgainLabel ?? "Try again"}
          </button>
        )}
      </div>
    </div>
  );
}

// Unified pre-generation setup panel — all the per-letter choices live
// here under a consistent labeled grid. Previously these controls were
// scattered across three rows with mixed alignments (channel left,
// output right, source pill floating); the result read as components
// "randomly placed". Grouping them into a single bordered panel with a
// fixed label column and consistent control column gives the section
// the visual hierarchy a setup form deserves.
function SetupPanel({
  sourceLanguage,
  channel,
  onChannelChange,
  outputLanguage,
  onOutputChange,
  recipientName,
  detectedRecipient,
  onRecipientChange,
  disabled,
  t,
}: {
  sourceLanguage: OutputLanguage | null;
  channel: "platform" | "direct";
  onChannelChange: (next: "platform" | "direct") => void;
  outputLanguage: OutputLanguage;
  onOutputChange: (next: OutputLanguage) => void;
  recipientName: string;
  detectedRecipient: string;
  onRecipientChange: (next: string) => void;
  disabled?: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  // Whether the user has overridden the auto-detected output language.
  // Surfaces a tiny "auto-detected" hint next to Output otherwise — gives
  // people a reason to trust the default instead of second-guessing it.
  const outputMatchesSource =
    sourceLanguage != null && outputLanguage === sourceLanguage;

  return (
    <div className="rounded-xl border border-border bg-surface-elevated">
      {sourceLanguage && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-small text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Languages className="h-3.5 w-3.5" />
            <span>{t("language.source")}</span>
            <span className="text-border">·</span>
            <span className="font-medium text-foreground">
              {t(`language.${sourceLanguage.toLowerCase()}`)}
            </span>
          </span>
        </div>
      )}

      <div className="space-y-3 px-4 py-3.5">
        <SetupRow label={t("channel.label")}>
          <div
            role="radiogroup"
            aria-label={t("channel.label")}
            className="inline-flex gap-1 rounded-lg border border-border bg-surface p-1"
          >
            <ChannelPill
              active={channel === "platform"}
              onClick={() => onChannelChange("platform")}
              disabled={disabled}
              label={t("channel.platform")}
              description={t("channel.platform_desc")}
            />
            <ChannelPill
              active={channel === "direct"}
              onClick={() => onChannelChange("direct")}
              disabled={disabled}
              label={t("channel.direct")}
              description={t("channel.direct_desc")}
            />
          </div>
        </SetupRow>

        <SetupRow label={t("language.output")}>
          <div className="flex items-center gap-2">
            <Select
              value={outputLanguage}
              onChange={(e) => onOutputChange(e.target.value as OutputLanguage)}
              aria-label={t("language.output")}
              disabled={disabled}
              className="h-8 w-auto pl-2.5 pr-8 py-1 text-small"
            >
              {OUTPUT_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {t(`language.${lang.toLowerCase()}`)}
                </option>
              ))}
            </Select>
            {outputMatchesSource && (
              <span className="text-small text-muted-foreground">
                {t("language.auto_detected")}
              </span>
            )}
          </div>
        </SetupRow>

        {channel === "direct" && (
          <SetupRow label={t("channel.recipient_label")}>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={recipientName}
                onChange={(e) => onRecipientChange(e.target.value)}
                placeholder={t("channel.recipient_placeholder")}
                disabled={disabled}
                maxLength={200}
                className="h-8 min-w-[200px] flex-1 bg-surface-elevated text-small"
                aria-label={t("channel.recipient_label")}
              />
              {detectedRecipient &&
                detectedRecipient !== recipientName &&
                recipientName === "" && (
                  <button
                    type="button"
                    onClick={() => onRecipientChange(detectedRecipient)}
                    disabled={disabled}
                    className="text-small text-primary hover:underline disabled:opacity-50"
                  >
                    {t("channel.recipient_use_detected", {
                      name: detectedRecipient,
                    })}
                  </button>
                )}
            </div>
          </SetupRow>
        )}
      </div>
    </div>
  );
}

// Generation progress. The server runs a real draft → humanize 2-pass; the
// client steps these labels on a timer and the bar holds near the end until
// the response actually arrives (the parent unmounts this once the letter is
// set), so it never falsely shows 100%.
const GEN_STAGES = [
  "reading_profile",
  "reading_job",
  "matching",
  "selecting_links",
  "writing",
  "humanizing",
  "finalizing",
] as const;

function GenerationProgress({
  t,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(i + 1, GEN_STAGES.length - 1);
      setStep(i);
      if (i >= GEN_STAGES.length - 1) clearInterval(id);
    }, 1600);
    return () => clearInterval(id);
  }, []);
  // Cap at 92% — the final jump to "done" happens when the parent swaps this
  // out for the finished letter.
  const pct = Math.min(92, Math.round(((step + 1) / (GEN_STAGES.length + 1)) * 100));
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center rounded-lg border border-border bg-surface-elevated px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-small font-medium text-foreground">
            {t("progress.title")}
          </span>
          <span className="text-label tabular-nums text-muted-foreground">
            {pct}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <ul className="mt-5 space-y-2.5">
          {GEN_STAGES.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={s} className="flex items-center gap-2.5 text-small">
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    done
                      ? "border-primary bg-primary"
                      : active
                        ? "border-primary"
                        : "border-border",
                  )}
                >
                  {active && (
                    <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />
                  )}
                </span>
                <span
                  className={cn(
                    done
                      ? "text-muted-foreground"
                      : active
                        ? "font-medium text-foreground"
                        : "text-muted-foreground/60",
                  )}
                >
                  {t(`progress.${s}`)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// Application-questions panel (full width, below both cards). The user can
// paste a vacancy's questions and get profile-matched answers; auto-extracted
// answers from generation land here too. Answers are editable; "Add to
// letter" (once a letter exists) appends them as a Q&A section.
function QuestionsPanel({
  questionsText,
  onQuestionsChange,
  onAnswer,
  answering,
  answers,
  onAnswerEdit,
  onAnswerRemove,
  onCombine,
  combined,
  canCombine,
  disabled,
  t,
}: {
  questionsText: string;
  onQuestionsChange: (value: string) => void;
  onAnswer: () => void;
  answering: boolean;
  answers: Array<{ question: string; answer: string }>;
  onAnswerEdit: (index: number, value: string) => void;
  onAnswerRemove: (index: number) => void;
  onCombine: () => void;
  combined: boolean;
  canCombine: boolean;
  disabled?: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <CardHeader title={t("questions.title")} subtitle={t("questions.subtitle")} />
      <div className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={questionsText}
            onChange={(e) => onQuestionsChange(e.target.value)}
            placeholder={t("questions.placeholder")}
            disabled={disabled}
            className="min-h-[88px] bg-surface-elevated text-small leading-6"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={onAnswer}
            disabled={disabled || questionsText.trim().length === 0}
          >
            {answering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {answering ? t("questions.answering") : t("questions.answer")}
          </Button>
        </div>

        {answers.length > 0 && (
          <div className="rounded-lg border border-border bg-surface-elevated p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-small font-semibold text-foreground">
                {t("answers.section_title")} ({answers.length})
              </span>
              {combined ? (
                <span className="text-label font-medium text-success">
                  {t("answers.combined")}
                </span>
              ) : canCombine ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onCombine}
                  disabled={disabled}
                >
                  <Plus className="h-4 w-4" />
                  {t("answers.combine")}
                </Button>
              ) : (
                <span className="text-label text-muted-foreground">
                  {t("answers.generate_first")}
                </span>
              )}
            </div>
            <ul className="mt-3 space-y-3">
              {answers.map((a, i) => (
                <li key={i}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-small font-medium text-foreground">
                      {i + 1}. {a.question}
                    </p>
                    <button
                      type="button"
                      onClick={() => onAnswerRemove(i)}
                      disabled={disabled}
                      aria-label={t("answers.remove")}
                      title={t("answers.remove")}
                      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface hover:text-destructive disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Textarea
                    value={a.answer}
                    onChange={(e) => onAnswerEdit(i, e.target.value)}
                    disabled={disabled}
                    className="mt-1 min-h-[64px] bg-surface text-small leading-6"
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

// Link selector. Lets the user choose exactly which of their links (profile
// Portfolio URL + eligible project links) the letter may reference. Default
// is "Auto" (the server includes a link only when it fits the role, and
// never force-adds an irrelevant one). Switching to manual reveals checkboxes
// for an explicit set — including the option to exclude the profile portfolio.
function LinkSelector({
  availableLinks,
  selection,
  onChange,
  disabled,
  t,
}: {
  availableLinks: SelectableLink[];
  selection: string[] | null;
  onChange: (next: string[] | null) => void;
  disabled?: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  if (availableLinks.length === 0) return null;
  const isAuto = selection === null;
  const selected = new Set(selection ?? []);
  const toggle = (url: string) => {
    const next = new Set(selected);
    if (next.has(url)) next.delete(url);
    else next.add(url);
    onChange([...next]);
  };
  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-small font-medium text-foreground">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          {t("links.title")}
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(isAuto ? [] : null)}
          className={cn(
            "rounded-md px-2 py-1 text-label font-medium transition-colors",
            "text-primary hover:bg-primary/10 disabled:opacity-50",
          )}
        >
          {isAuto ? t("links.customize") : t("links.use_auto")}
        </button>
      </div>
      <p className="mt-1 text-label text-muted-foreground">
        {isAuto ? t("links.auto_hint") : t("links.manual_hint")}
      </p>
      {!isAuto && (
        <ul className="mt-2 space-y-1">
          {availableLinks.map((l) => {
            const checked = selected.has(l.url);
            return (
              <li key={l.url}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(l.url)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-small text-foreground">
                        {l.label}
                      </span>
                      {l.kind === "profile" && (
                        <span className="shrink-0 rounded border border-border bg-surface px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t("links.profile_badge")}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {l.url}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// One row inside the SetupPanel. Fixed-width label column on the left,
// flexible control column on the right. Using a flex with a fixed-width
// label gives us consistent vertical rhythm regardless of label length
// (Russian + Armenian labels are 1.5–2× the English width).
function SetupRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-[120px] shrink-0 text-small text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function ChannelPill({
  active,
  onClick,
  disabled,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      disabled={disabled}
      title={description}
      className={cn(
        "rounded-md px-2.5 py-1 text-small font-medium transition-colors",
        active
          ? "bg-surface text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {label}
    </button>
  );
}


// "This job description is in X. Generate in X?" banner, shown only when
// the *source* language of the job content differs from the user's chosen
// output language. Critically, this compares sourceLanguage vs
// outputLanguage — never sourceLanguage vs uiLanguage — so changing the
// interface locale alone never produces a wrong suggestion.
function SmartSuggestion({
  source,
  sourceLabel,
  t,
  onAccept,
  disabled,
}: {
  source: OutputLanguage;
  sourceLabel: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onAccept: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-accent-soft p-3 text-small">
      <div className="min-w-0 flex-1">
        <div className="text-foreground">
          {t("smart_suggestion.intro", { detected: sourceLabel })}
        </div>
        <p className="text-muted-foreground">
          {t("smart_suggestion.question", { detected: sourceLabel })}
        </p>
      </div>
      <button
        type="button"
        onClick={onAccept}
        disabled={disabled}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-small font-medium text-primary-foreground shadow-sm transition-colors",
          "hover:bg-primary/90",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {/* `source` is OutputLanguage union; `sourceLabel` is the localized
            human-readable label inserted into the translation string. */}
        {t("smart_suggestion.button", { detected: sourceLabel })}
        <span className="hidden">{source}</span>
      </button>
    </div>
  );
}
