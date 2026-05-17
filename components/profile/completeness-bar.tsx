import { cn } from "@/lib/utils";

interface Props {
  value: number; // 0–100
  threshold?: number; // optional gate marker (e.g. 60 for cover letters)
  className?: string;
  hint?: string;
}

export function CompletenessBar({ value, threshold, className, hint }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const reached = threshold == null ? true : pct >= threshold;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-small">
        <span className="text-secondary-foreground">Profile completeness</span>
        <span
          className={cn(
            "tabular-nums font-medium",
            reached ? "text-foreground" : "text-warning",
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            reached ? "bg-primary" : "bg-warning",
          )}
          style={{ width: `${pct}%` }}
        />
        {threshold != null && threshold > 0 && threshold < 100 && (
          <div
            className="absolute inset-y-0 w-px bg-border"
            style={{ left: `${threshold}%` }}
            aria-hidden
          />
        )}
      </div>
      {hint && <p className="text-small text-muted-foreground">{hint}</p>}
    </div>
  );
}
