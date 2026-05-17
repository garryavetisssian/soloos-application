"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  examples?: string;
  disabled?: boolean;
}

export function TagInput({
  value,
  onChange,
  placeholder,
  max,
  examples,
  disabled,
}: Props) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const t = draft.trim();
    if (!t) return;
    if (value.includes(t)) {
      setDraft("");
      return;
    }
    if (max && value.length >= max) return;
    onChange([...value, t]);
    setDraft("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Backspace" && draft.length === 0 && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  const atLimit = max != null && value.length >= max;

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1.5 shadow-sm focus-within:ring-1 focus-within:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        {value.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 rounded-md bg-surface-elevated px-2 py-0.5 text-small"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={disabled}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onBlur={commitDraft}
          placeholder={atLimit ? `Max ${max} reached` : placeholder}
          disabled={disabled || atLimit}
          className="min-w-[120px] flex-1 bg-transparent py-0.5 text-body outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>
      {examples && (
        <p className="text-small text-muted-foreground">Examples: {examples}</p>
      )}
      {max != null && (
        <p className="text-small text-muted-foreground">
          {value.length} / {max}
        </p>
      )}
    </div>
  );
}
