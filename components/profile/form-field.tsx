import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  id?: string;
  children: React.ReactNode;
  // Right-aligned content next to the label, e.g. character counter.
  meta?: React.ReactNode;
}

export function FormField({
  label,
  required,
  hint,
  error,
  className,
  id,
  meta,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-small text-secondary-foreground"
        >
          {label}{" "}
          {required ? (
            <span aria-hidden className="text-destructive">
              *
            </span>
          ) : (
            <span className="text-muted-foreground">(Optional)</span>
          )}
        </label>
        {meta && <div className="text-small text-muted-foreground">{meta}</div>}
      </div>
      {hint && !error && (
        <p className="text-small text-muted-foreground">{hint}</p>
      )}
      {children}
      {error && (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
