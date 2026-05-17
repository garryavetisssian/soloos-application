"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  Copy,
  Download,
  Globe,
  Languages,
  Loader2,
  Mail,
  PencilLine,
  Search,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useT } from "@/lib/i18n/hooks";
import { cn } from "@/lib/utils";
import { deleteCoverLetterAction } from "./actions";
import type { SavedLetterRow } from "./library-types";
import { useActionLock } from "@/lib/ui/action-lock";
import { useToast } from "@/lib/ui/toast";

type LanguageFilter = "all" | "English" | "Russian" | "Armenian";
type SourceFilter = "all" | "manual" | "job_link";

const LANGUAGE_FILTERS: ReadonlyArray<LanguageFilter> = [
  "all",
  "English",
  "Russian",
  "Armenian",
];
const SOURCE_FILTERS: ReadonlyArray<SourceFilter> = [
  "all",
  "manual",
  "job_link",
];

interface ToolbarProps {
  count: number;
}

// Lightweight standalone toolbar — purely informational. Uses the i18n
// hook directly so the parent server component doesn't try to pass a
// function across the server/client boundary (Next disallows that).
export function LibraryToolbar({ count }: ToolbarProps) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-3 text-small text-muted-foreground">
      <span>{t("cover_letter.library.count", { count })}</span>
    </div>
  );
}

interface GridProps {
  letters: SavedLetterRow[];
}

export function LibraryGrid({ letters }: GridProps) {
  const t = useT();
  const tt = (key: string, vars?: Record<string, string | number>) =>
    t(`cover_letter.${key}`, vars);

  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<LanguageFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return letters.filter((l) => {
      if (language !== "all" && l.language !== language) return false;
      if (source !== "all" && l.source_type !== source) return false;
      if (!q) return true;
      const hay = `${l.job_title ?? ""} ${l.company_name ?? ""} ${l.content}`
        .toLowerCase();
      return hay.includes(q);
    });
  }, [letters, query, language, source]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tt("library.search_placeholder")}
            className="bg-surface-elevated pl-9"
            aria-label={tt("library.search_placeholder")}
          />
        </div>
        <Select
          value={language}
          onChange={(e) => setLanguage(e.target.value as LanguageFilter)}
          aria-label={tt("library.filter_language")}
          className="h-9 w-auto px-2 py-1 text-small"
        >
          {LANGUAGE_FILTERS.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "all"
                ? tt("library.filter_all_languages")
                : tt(`language.${opt.toLowerCase()}`)}
            </option>
          ))}
        </Select>
        <Select
          value={source}
          onChange={(e) => setSource(e.target.value as SourceFilter)}
          aria-label={tt("library.filter_source")}
          className="h-9 w-auto px-2 py-1 text-small"
        >
          {SOURCE_FILTERS.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "all"
                ? tt("library.filter_all_sources")
                : opt === "manual"
                  ? tt("library.source_manual")
                  : tt("library.source_job_link")}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-10 text-small text-muted-foreground">
          {tt("library.no_results")}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((letter) => (
            <li key={letter.id}>
              <LetterCard letter={letter} t={tt} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface LetterCardProps {
  letter: SavedLetterRow;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

function LetterCard({ letter, t }: LetterCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { run, isLocked } = useActionLock();
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingPending, startDelete] = useTransition();

  const heading =
    [letter.job_title, letter.company_name].filter(Boolean).join(" · ") ||
    t("library.untitled");
  const preview = previewOf(letter.content);
  const updatedAt = letter.updated_at ?? letter.created_at;

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(letter.content);
      toast.success(t("actions.copy_success"));
    } catch {
      toast.error(t("errors.copy_title"));
    }
  }

  function handleExportPdf(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    void run(async () => {
      setExporting(true);
      try {
        const res = await fetch("/api/export/cover-letter-pdf", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            content: letter.content,
            job_title: letter.job_title ?? undefined,
            company_name: letter.company_name ?? undefined,
          }),
        });
        if (!res.ok) {
          toast.error(t("errors.pdf_title"));
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
        toast.success(t("actions.pdf_success"));
      } catch {
        toast.error(t("errors.pdf_title"));
      } finally {
        setExporting(false);
      }
    });
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      // Auto-revert if the user doesn't confirm within a few seconds.
      window.setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    startDelete(async () => {
      const result = await run(() => deleteCoverLetterAction(letter.id));
      if (!result) return; // lock held
      if (!result.ok) {
        toast.error(t("errors.delete_title"));
        setConfirmDelete(false);
        return;
      }
      toast.success(t("actions.delete_success"));
      router.refresh();
    });
  }

  return (
    <Link
      href={`/cover-letters/${letter.id}`}
      className={cn(
        "group block rounded-2xl border border-border bg-surface p-5 transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-primary/40",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
          <Mail className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-body font-medium text-foreground">
            {heading}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-small text-muted-foreground">
            <span>{formatDate(updatedAt)}</span>
            {letter.language && (
              <>
                <span className="text-border">·</span>
                <span className="inline-flex items-center gap-1">
                  <Languages className="h-3 w-3" />
                  {t(`language.${letter.language.toLowerCase()}`)}
                </span>
              </>
            )}
            {letter.source_type && (
              <>
                <span className="text-border">·</span>
                <span className="inline-flex items-center gap-1">
                  {letter.source_type === "job_link" ? (
                    <Globe className="h-3 w-3" />
                  ) : (
                    <PencilLine className="h-3 w-3" />
                  )}
                  {letter.source_type === "job_link"
                    ? t("library.source_job_link")
                    : t("library.source_manual")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <p className="mt-4 line-clamp-3 text-small text-secondary-foreground">
        {preview}
      </p>

      <div className="mt-5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-small font-medium text-primary opacity-70 transition-opacity group-hover:opacity-100">
          {t("library.open")}
          <ArrowRight className="h-3 w-3" />
        </span>
        <div className="flex items-center gap-0.5">
          <CardIconButton title={t("actions.copy")} onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5" />
          </CardIconButton>
          <CardIconButton
            title={t("actions.export_pdf")}
            onClick={handleExportPdf}
            disabled={isLocked}
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </CardIconButton>
          <CardIconButton
            title={
              confirmDelete
                ? t("actions.delete_confirm")
                : t("actions.delete")
            }
            onClick={handleDeleteClick}
            disabled={isLocked}
            variant={confirmDelete ? "danger" : "default"}
          >
            {deletingPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </CardIconButton>
        </div>
      </div>
    </Link>
  );
}

function CardIconButton({
  title,
  onClick,
  disabled,
  variant = "default",
  children,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  variant?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-surface-elevated hover:text-foreground",
        variant === "danger" &&
          "bg-destructive/15 text-destructive hover:bg-destructive/25 hover:text-destructive",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      {children}
    </button>
  );
}

// Strip the salutation/closing for the card preview so the snippet leads
// with the actual opening sentence — way more useful than "Dear hiring
// team," repeated across every card.
function previewOf(content: string): string {
  const trimmed = content.trim();
  // Drop the first line if it looks like a greeting.
  const lines = trimmed.split(/\r?\n/);
  const greetingRe = /^(dear|hi|hello|здравствуйте|привет|բարև)/i;
  let start = 0;
  while (start < lines.length && lines[start].trim().length === 0) start++;
  if (start < lines.length && greetingRe.test(lines[start])) start++;
  return lines.slice(start).join(" ").replace(/\s+/g, " ").trim();
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
