"use client";

import { useRef, useState, type DragEvent } from "react";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onFile: (file: File) => void;
  accept?: string;
  maxBytes?: number;
  selected?: File | null;
  onClear?: () => void;
  disabled?: boolean;
}

export function FileDrop({
  onFile,
  accept = "application/pdf",
  maxBytes,
  selected,
  onClear,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setError(null);
    if (accept && !file.type.match(accept.replace("*", ".*"))) {
      setError(`Unsupported file type. Expected ${accept}.`);
      return;
    }
    if (maxBytes && file.size > maxBytes) {
      setError(
        `File too large. Max ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`,
      );
      return;
    }
    onFile(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setHover(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="truncate text-body">{selected.name}</div>
            <div className="text-small text-muted-foreground">
              {(selected.size / 1024).toFixed(0)} KB
            </div>
          </div>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface px-6 py-10 text-center transition-colors",
          "hover:border-primary/60 hover:bg-surface-elevated",
          hover && "border-primary bg-surface-elevated",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <div className="text-body">
          <span className="text-foreground">Drop your CV here</span>{" "}
          <span className="text-muted-foreground">or click to browse</span>
        </div>
        <div className="text-small text-muted-foreground">PDF only</div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {error && (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
