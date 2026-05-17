"use client";

import { useRef, useState, type DragEvent } from "react";
import {
  AlertTriangle,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UploadState =
  | { kind: "empty" }
  | { kind: "selected"; file: File }
  | { kind: "analyzing"; file: File }
  | { kind: "error"; file?: File; message: string; subtext?: string };

interface Props {
  state: UploadState;
  onFile: (file: File) => void;
  onAnalyze: () => void;
  onClear: () => void;
  onContinueManually?: () => void;
}

const ACCEPT = "application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

export function UploadCVCard({
  state,
  onFile,
  onAnalyze,
  onClear,
  onContinueManually,
}: Props) {
  switch (state.kind) {
    case "empty":
      return <DropZone onFile={onFile} />;
    case "selected":
      return (
        <SelectedFile
          file={state.file}
          onAnalyze={onAnalyze}
          onClear={onClear}
        />
      );
    case "analyzing":
      return <Analyzing file={state.file} />;
    case "error":
      return (
        <ErrorState
          file={state.file}
          message={state.message}
          subtext={state.subtext}
          onClear={onClear}
          onContinueManually={onContinueManually}
        />
      );
  }
}

function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validateAndPick(file: File) {
    setError(null);
    if (file.type !== ACCEPT) {
      setError("Only PDF files are supported.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File too large. Max 10 MB.");
      return;
    }
    onFile(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setHover(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndPick(file);
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={cn(
          "group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-surface px-8 py-12 text-center transition-all",
          "hover:border-primary/60 hover:bg-surface-elevated",
          hover
            ? "border-primary bg-surface-elevated"
            : "border-border",
        )}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated text-foreground transition-colors group-hover:bg-primary/15 group-hover:text-primary">
          <Upload className="h-5 w-5" />
        </span>
        <div>
          <div className="text-body font-medium text-foreground">
            Drop your CV here
          </div>
          <p className="pt-0.5 text-small text-muted-foreground">
            or click to browse · PDF, up to 10 MB
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) validateAndPick(f);
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

function SelectedFile({
  file,
  onAnalyze,
  onClear,
}: {
  file: File;
  onAnalyze: () => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="text-small font-medium uppercase tracking-wide text-success">
              CV ready
            </div>
            <div className="truncate pt-0.5 text-body text-foreground">
              {file.name}
            </div>
            <div className="text-small text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Remove file"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="pt-5">
        <Button onClick={onAnalyze}>
          <Sparkles className="h-4 w-4" />
          Analyze CV
        </Button>
      </div>
    </div>
  );
}

function Analyzing({ file }: { file: File }) {
  const heading = "Analyzing your CV…";
  const sub = "Reading the document and extracting your career profile.";
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </span>
        <div className="min-w-0">
          <div className="text-body font-medium text-foreground">{heading}</div>
          <p className="pt-0.5 text-small text-muted-foreground">{sub}</p>
          <div className="truncate pt-2 text-small text-muted-foreground">
            {file.name}
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({
  file,
  message,
  subtext,
  onClear,
  onContinueManually,
}: {
  file?: File;
  message: string;
  subtext?: string;
  onClear: () => void;
  onContinueManually?: () => void;
}) {
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/5 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/15 text-warning">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="text-body font-medium text-foreground">{message}</div>
          {subtext && (
            <p className="pt-1 text-small text-muted-foreground">{subtext}</p>
          )}
          {file && (
            <div className="truncate pt-2 text-small text-muted-foreground">
              {file.name}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={onClear}>
              Upload another CV
            </Button>
            {onContinueManually && (
              <Button variant="ghost" size="sm" onClick={onContinueManually}>
                Continue manually
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
