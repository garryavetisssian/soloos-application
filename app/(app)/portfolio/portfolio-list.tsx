"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  GitBranch,
  Globe,
  Image as ImageIcon,
  Loader2,
  PencilLine,
  Plus,
  RefreshCw,
  Sparkles,
  Store,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/hooks";
import { useActionLock } from "@/lib/ui/action-lock";
import { useToast } from "@/lib/ui/toast";
import { cn } from "@/lib/utils";
import {
  isAnalysisPending,
  LINK_USAGE_THRESHOLD,
  scoreLink,
  type IssueKey,
  type LinkQuality,
  type QualityBand,
} from "@/lib/work-links/quality";
import type { WorkLinkRow, WorkLinkType } from "@/lib/work-links/types";
import {
  addWorkLinkAction,
  deleteWorkLinkAction,
  recheckWorkLinkAction,
  updateWorkLinkAction,
  type AddWorkLinkResult,
} from "./actions";

interface Props {
  links: WorkLinkRow[];
}

export function PortfolioList({ links }: Props) {
  const t = useT();
  const tt = (key: string, vars?: Record<string, string | number>) =>
    t(`portfolio.${key}`, vars);
  const { isLocked } = useActionLock();
  const [addOpen, setAddOpen] = useState(false);
  const [prefillUrl, setPrefillUrl] = useState("");

  function openWithUrl(url: string) {
    setPrefillUrl(url);
    setAddOpen(true);
  }

  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3 tracking-tight">
          {tt("section_title", { count: links.length })}
        </h2>
        <Button onClick={() => openWithUrl("")} disabled={isLocked}>
          <Plus className="h-4 w-4" />
          {tt("add_link")}
        </Button>
      </div>

      {links.length === 0 ? (
        <EmptyState onAdd={() => openWithUrl("")} t={tt} />
      ) : (
        <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2">
          {links.map((link) => (
            <li key={link.id} className="h-full">
              <LinkCard link={link} t={tt} />
            </li>
          ))}
        </ul>
      )}

      <AddLinkModal
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) setPrefillUrl("");
        }}
        initialUrl={prefillUrl}
        t={tt}
      />
    </section>
  );
}

// ===================================================================
// Empty state
// ===================================================================

function EmptyState({
  onAdd,
  t,
}: {
  onAdd: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated text-primary">
        <Sparkles className="h-5 w-5" />
      </span>
      <div>
        <h3 className="text-h3 tracking-tight">{t("empty.title")}</h3>
        <p className="pt-1 text-small text-muted-foreground">
          {t("empty.body")}
        </p>
      </div>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4" />
        {t("add_first")}
      </Button>
    </div>
  );
}

// ===================================================================
// LinkCard — single saved link
// ===================================================================

function LinkCard({
  link,
  t,
}: {
  link: WorkLinkRow;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { run, isLocked } = useActionLock();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Local pending flags keep each action's own loader / spinner
  // accurate while the global lock disables OTHER buttons.
  const [recheckingPending, setRecheckingPending] = useState(false);
  const [deletingPending, setDeletingPending] = useState(false);
  const quality = scoreLink(link);

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard
      .writeText(link.url)
      .then(() => toast.success(t("toast.copied")))
      .catch(() => toast.error(t("toast.copy_failed")));
  }

  function handleRecheck(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    void run(async () => {
      setRecheckingPending(true);
      try {
        const result = await recheckWorkLinkAction(link.id);
        if (!result.ok) {
          toast.error(t("toast.recheck_failed"));
          return;
        }
        toast.success(t("toast.rechecked"));
        router.refresh();
      } finally {
        setRecheckingPending(false);
      }
    });
  }

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      window.setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    void run(async () => {
      setDeletingPending(true);
      try {
        const result = await deleteWorkLinkAction(link.id);
        if (!result.ok) {
          toast.error(t("toast.delete_failed"));
          setConfirmDelete(false);
          return;
        }
        toast.success(t("toast.deleted"));
        router.refresh();
      } finally {
        setDeletingPending(false);
      }
    });
  }

  async function handleToggleUse() {
    const next = !link.use_in_cover_letter;
    await run(async () => {
      const result = await updateWorkLinkAction({
        id: link.id,
        use_in_cover_letter: next,
      });
      if (!result.ok) {
        toast.error(t("toast.toggle_failed"));
        return;
      }
      toast.success(next ? t("toast.enabled") : t("toast.disabled"));
      router.refresh();
    });
  }

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl border bg-surface p-5 transition-colors",
        link.status === "broken"
          ? "border-warning/40"
          : "border-border hover:border-primary/40",
        !link.use_in_cover_letter && "opacity-75",
      )}
    >
      <div className="flex items-start gap-3">
        <TypeIcon type={link.type} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              className="truncate text-body font-medium text-foreground hover:text-primary"
            >
              {link.title || link.url}
            </a>
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-small text-muted-foreground">
            <TypeBadge type={link.type} t={t} />
            <span className="text-border">·</span>
            <span className="truncate">{prettyUrl(link.url)}</span>
            {link.status === "broken" && (
              <>
                <span className="text-border">·</span>
                <span className="inline-flex items-center gap-1 text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  {t("status.broken")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body — flex-1 so card heights match in a row. Always renders
          something (real summary, pending notice, or the rename-frames
          placeholder) so cards never collapse. Pending takes priority
          since the "rename your pages" prompt would be misleading for a
          link that hasn't been analyzed at all yet. */}
      <div className="mt-3 flex flex-1 flex-col gap-2">
        {link.summary ? (
          <p className="text-small text-secondary-foreground">{link.summary}</p>
        ) : quality.band === "pending" ? (
          <p className="text-small italic text-muted-foreground">
            {t("empty_summary.pending_body")}
          </p>
        ) : (
          <p className="text-small italic text-muted-foreground">
            {t("empty_summary.body")}
          </p>
        )}
        {link.cover_letter_hint && (
          <p className="inline-flex items-start gap-1.5 text-small text-muted-foreground">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
            <span>{link.cover_letter_hint}</span>
          </p>
        )}
      </div>

      <QualityBar quality={quality} t={t} />

      {/* Toggle row. Hard-locks when the quality score is below the
          usage threshold OR the link is in the honest "pending
          analysis" state (Figma API was rate-locked when we tried).
          The two states get distinct copy so users know whether to
          fix something vs just wait for the rate limit. */}
      <ToggleRow
        link={link}
        quality={quality}
        onToggle={handleToggleUse}
        onRecheck={handleRecheck}
        recheckPending={recheckingPending}
        disabled={isLocked}
        t={t}
      />

      <div className="mt-3 flex flex-wrap items-center gap-1">
        <IconButton
          title={t("actions.edit")}
          onClick={() => setEditing(true)}
          disabled={isLocked}
        >
          <PencilLine className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton title={t("actions.copy")} onClick={handleCopy}>
          <Copy className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton
          title={t("actions.recheck")}
          onClick={handleRecheck}
          disabled={isLocked}
        >
          {recheckingPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </IconButton>
        <IconButton
          title={confirmDelete ? t("actions.delete_confirm") : t("actions.delete")}
          onClick={handleDelete}
          disabled={isLocked}
          variant={confirmDelete ? "danger" : "default"}
        >
          {deletingPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </IconButton>
      </div>

      <EditLinkModal
        link={link}
        open={editing}
        onOpenChange={setEditing}
        t={t}
      />
    </article>
  );
}

function IconButton({
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

// ===================================================================
// AddLinkModal — paste URL, validate, AI summary preview, save
// ===================================================================

function AddLinkModal({
  open,
  onOpenChange,
  initialUrl,
  t,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  initialUrl: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { run } = useActionLock();
  const [url, setUrl] = useState(initialUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AddWorkLinkResult | null>(null);

  // Reset state when modal opens/closes or the initial URL changes.
  function resetTo(nextUrl: string) {
    setUrl(nextUrl);
    setError(null);
    setResult(null);
    setPending(false);
  }

  // Sync prefilled URL when the modal opens. We only do this on the
  // open→true transition so the user's in-modal edits aren't clobbered.
  useEffect(() => {
    if (open) resetTo(initialUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setResult(null);
    setPending(true);
    try {
      const r = await run(() => addWorkLinkAction(url));
      // r === undefined when the global lock rejected the call. The
      // user shouldn't be able to reach this state from the modal
      // (the submit button disables on `pending`), but be defensive.
      if (!r) return;
      if (r.ok) {
        setResult(r);
        toast.success(t("toast.added"));
        router.refresh();
      } else {
        setError(r.message);
      }
    } finally {
      setPending(false);
    }
  }

  function handleClose() {
    onOpenChange(false);
    // Defer reset so the close animation can use the last state.
    window.setTimeout(() => resetTo(""), 200);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
        else onOpenChange(o);
      }}
    >
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
            "fixed left-1/2 top-1/2 z-50 flex w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-2xl",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
          aria-describedby={undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-h3 tracking-tight">
              {t("add_modal.title")}
            </Dialog.Title>
            <Dialog.Close
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
              aria-label={t("actions.close")}
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <p className="text-small text-muted-foreground">
            {t("add_modal.body")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="text"
              inputMode="url"
              spellCheck={false}
              autoCorrect="off"
              autoFocus
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
                if (result) setResult(null);
              }}
              placeholder={t("add_modal.placeholder")}
              disabled={pending || result?.ok === true}
              className="bg-surface-elevated"
            />

            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/5 p-3 text-small"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="min-w-0 flex-1 text-foreground">{error}</div>
              </div>
            )}

            {result?.ok && (
              <div className="space-y-2 rounded-md border border-success/30 bg-success/5 p-3 text-small">
                <div className="flex items-center gap-2 text-foreground">
                  <Check className="h-4 w-4 text-success" />
                  <span className="font-medium">{result.title}</span>
                </div>
                {result.summary && (
                  <p className="text-secondary-foreground">{result.summary}</p>
                )}
                {result.coverLetterHint && (
                  <p className="inline-flex items-start gap-1.5 text-muted-foreground">
                    <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    <span>{result.coverLetterHint}</span>
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              {result?.ok ? (
                <Button type="button" onClick={handleClose}>
                  {t("add_modal.done")}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={pending}
                  >
                    {t("actions.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={pending || url.trim().length === 0}
                  >
                    {pending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("add_modal.checking")}
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        {t("add_modal.add")}
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ===================================================================
// EditLinkModal — edit AI-generated title/summary/hint
// ===================================================================

function EditLinkModal({
  link,
  open,
  onOpenChange,
  t,
}: {
  link: WorkLinkRow;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { run } = useActionLock();
  const [title, setTitle] = useState(link.title ?? "");
  const [summary, setSummary] = useState(link.summary ?? "");
  const [hint, setHint] = useState(link.cover_letter_hint ?? "");
  const [pending, setPending] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const result = await run(() =>
        updateWorkLinkAction({
          id: link.id,
          title,
          summary,
          cover_letter_hint: hint,
        }),
      );
      if (!result) return; // lock was held
      if (result.ok) {
        toast.success(t("toast.saved"));
        router.refresh();
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setTitle(link.title ?? "");
          setSummary(link.summary ?? "");
          setHint(link.cover_letter_hint ?? "");
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-h3 tracking-tight">
              {t("edit_modal.title")}
            </Dialog.Title>
            <Dialog.Close
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
              aria-label={t("actions.close")}
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <form onSubmit={handleSave} className="space-y-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-small text-muted-foreground">
                {t("edit_modal.title_label")}
              </span>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("edit_modal.title_placeholder")}
                maxLength={200}
                className="bg-surface-elevated"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-small text-muted-foreground">
                {t("edit_modal.summary_label")}
              </span>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder={t("edit_modal.summary_placeholder")}
                maxLength={600}
                rows={3}
                className="bg-surface-elevated text-small"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-small text-muted-foreground">
                {t("edit_modal.hint_label")}
              </span>
              <Textarea
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder={t("edit_modal.hint_placeholder")}
                maxLength={400}
                rows={2}
                className="bg-surface-elevated text-small"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                {t("actions.cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {t("edit_modal.save")}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ===================================================================
// Small helpers — type icon/badge, URL pretty-printer
// ===================================================================

function TypeIcon({ type }: { type: WorkLinkType }) {
  const meta = TYPE_META[type];
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
        meta.iconBg,
      )}
    >
      {meta.icon}
    </span>
  );
}

function TypeBadge({
  type,
  t,
}: {
  type: WorkLinkType;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <span className="text-foreground">{t(`type.${type}`)}</span>
  );
}

// Tiny accessible switch — built local to the file because we don't
// (yet) have a global Switch primitive in the design system. Renders
// as a pill with a sliding thumb; ARIA-correct so screen readers
// announce it as a switch with on/off state.
function Switch({
  checked,
  onCheckedChange,
  ariaLabel,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onCheckedChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors",
        checked
          ? "border-primary/60 bg-primary/30"
          : "border-border bg-surface-elevated",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 inline-block h-4 w-4 rounded-full bg-foreground transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

// Toggle row. Three states:
//   1. PENDING — we couldn't analyze yet (Figma API was rate-locked
//      AND Vision returned nothing). Neutral copy + Re-check CTA;
//      explains the up-to-3-day Figma free-plan wait.
//   2. LOCKED — we DID analyze, but the score is below the usage
//      threshold (the file genuinely has weak signals). Warning copy
//      that points at the issue described above the toggle.
//   3. NORMAL — score is fine. Toggle is the only gate.
function ToggleRow({
  link,
  quality,
  onToggle,
  onRecheck,
  recheckPending,
  disabled,
  t,
}: {
  link: WorkLinkRow;
  quality: LinkQuality;
  onToggle: () => void;
  onRecheck: (e: React.MouseEvent) => void;
  recheckPending: boolean;
  disabled: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const analysisPending = isAnalysisPending(link);
  const scoreLocked =
    !analysisPending &&
    link.status === "ready" &&
    quality.score < LINK_USAGE_THRESHOLD;

  if (analysisPending) {
    return (
      <div className="mt-3 flex flex-col gap-2 rounded-md border border-border bg-surface-elevated/40 px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-small font-medium text-foreground">
              {t("use_toggle.pending_title")}
            </div>
            <p className="text-small text-muted-foreground">
              {t("use_toggle.pending_body")}
            </p>
          </div>
          <Switch
            checked={false}
            onCheckedChange={() => {}}
            ariaLabel={t("use_toggle.aria")}
            disabled
          />
        </div>
        <button
          type="button"
          onClick={onRecheck}
          disabled={disabled || recheckPending}
          className={cn(
            "self-start inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-small text-foreground transition-colors",
            "hover:bg-surface-elevated",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {recheckPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          <span>{t("use_toggle.try_recheck_now")}</span>
        </button>
      </div>
    );
  }

  if (scoreLocked) {
    return (
      <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
        <div className="min-w-0">
          <div className="text-small font-medium text-warning">
            {t("use_toggle.locked_title")}
          </div>
          <p className="text-small text-muted-foreground">
            {t("use_toggle.locked_body", {
              threshold: LINK_USAGE_THRESHOLD,
            })}
          </p>
        </div>
        <Switch
          checked={false}
          onCheckedChange={() => {}}
          ariaLabel={t("use_toggle.aria")}
          disabled
        />
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border bg-surface-elevated/40 px-3 py-2">
      <div className="min-w-0">
        <div className="text-small font-medium text-foreground">
          {link.use_in_cover_letter
            ? t("use_toggle.on_title")
            : t("use_toggle.off_title")}
        </div>
        <p className="text-small text-muted-foreground">
          {link.use_in_cover_letter
            ? t("use_toggle.on_body")
            : t("use_toggle.off_body")}
        </p>
      </div>
      <Switch
        checked={link.use_in_cover_letter}
        onCheckedChange={onToggle}
        ariaLabel={t("use_toggle.aria")}
        disabled={disabled}
      />
    </div>
  );
}

// Per-link quality bar. Score (0–100) is computed from structural
// signals captured during validation: named-frame ratio, components,
// styles, text-layer count, image fills, thumbnail size — plus the
// metadata baseline (title meaningful, summary present + grounded,
// hint present, toggle on). The breakdown pills show *which* signals
// went into the score so the user can see why. The hint below names
// the single highest-impact thing to fix.
function QualityBar({
  quality,
  t,
}: {
  quality: LinkQuality;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const palette: Record<
    QualityBand,
    { bar: string; text: string; bg: string }
  > = {
    // Pending = neutral, not alarming. "We haven't graded yet" should
    // never read like "this link is bad" — the bar stays muted so the
    // visual emphasis lands on the explanation text below.
    pending: {
      bar: "bg-muted-foreground/40",
      text: "text-muted-foreground",
      bg: "bg-surface-elevated",
    },
    weak: { bar: "bg-destructive/70", text: "text-destructive", bg: "bg-destructive/15" },
    basic: { bar: "bg-warning/70", text: "text-warning", bg: "bg-warning/15" },
    good: { bar: "bg-primary/70", text: "text-primary", bg: "bg-primary/15" },
    great: { bar: "bg-success/70", text: "text-success", bg: "bg-success/15" },
  };
  const tone = palette[quality.band];
  const topIssue: IssueKey | undefined = quality.issues[0];
  const showHint = quality.band !== "great" && topIssue != null;
  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-small">
        <span className={cn("font-medium", tone.text)}>
          {t(`quality.band.${quality.band}`)}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {quality.score}/100
        </span>
      </div>
      <div
        className={cn("h-1.5 w-full overflow-hidden rounded-full", tone.bg)}
        role="progressbar"
        aria-valuenow={quality.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("quality.aria_label", { score: quality.score })}
      >
        <div
          className={cn("h-full rounded-full transition-all", tone.bar)}
          style={{ width: `${Math.max(quality.score, 4)}%` }}
        />
      </div>
      {quality.breakdown.length > 0 && (
        <ul className="flex flex-wrap gap-1 pt-0.5">
          {quality.breakdown.map((b) => (
            <li
              key={b.labelKey}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-small",
                b.tone === "warn"
                  ? "border-warning/40 bg-warning/10 text-warning"
                  : "border-border bg-surface-elevated/60 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "font-medium tabular-nums",
                  b.tone === "warn" ? "text-warning" : "text-foreground",
                )}
              >
                {b.value}
              </span>
              <span>{t(b.labelKey)}</span>
            </li>
          ))}
        </ul>
      )}
      {showHint && (
        <p className="pt-1 text-small text-muted-foreground">
          <span className={cn("font-medium", tone.text)}>
            {t("quality.hint_label")}
          </span>{" "}
          {t(`quality.issue.${topIssue}`)}
        </p>
      )}
    </div>
  );
}

const TYPE_META: Record<
  WorkLinkType,
  { iconBg: string; icon: React.ReactNode }
> = {
  portfolio: {
    iconBg: "bg-primary/15 text-primary",
    icon: <Globe className="h-4 w-4" />,
  },
  github: {
    iconBg: "bg-emerald-500/15 text-emerald-400",
    icon: <GitBranch className="h-4 w-4" />,
  },
  figma: {
    iconBg: "bg-violet-500/15 text-violet-400",
    icon: <ImageIcon className="h-4 w-4" />,
  },
  dribbble: {
    iconBg: "bg-pink-500/15 text-pink-400",
    icon: <ImageIcon className="h-4 w-4" />,
  },
  behance: {
    iconBg: "bg-blue-500/15 text-blue-400",
    icon: <ImageIcon className="h-4 w-4" />,
  },
  app_store: {
    iconBg: "bg-cyan-500/15 text-cyan-400",
    icon: <Store className="h-4 w-4" />,
  },
  article: {
    iconBg: "bg-amber-500/15 text-amber-400",
    icon: <FileText className="h-4 w-4" />,
  },
  video: {
    iconBg: "bg-rose-500/15 text-rose-400",
    icon: <Video className="h-4 w-4" />,
  },
  other: {
    iconBg: "bg-surface-elevated text-muted-foreground",
    icon: <ChevronDown className="h-4 w-4" />,
  },
};

function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}
