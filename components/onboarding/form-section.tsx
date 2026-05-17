import { cn } from "@/lib/utils";

interface Props {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

// Card-shaped section wrapper used inside the onboarding main column.
// Replaces the previous "floating fields on empty space" feel.
export function FormSection({ title, description, children, className }: Props) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-surface p-6 sm:p-7",
        className,
      )}
    >
      {(title || description) && (
        <header className="pb-5">
          {title && <h3 className="text-h3">{title}</h3>}
          {description && (
            <p className="pt-1 text-small text-muted-foreground">
              {description}
            </p>
          )}
        </header>
      )}
      <div className="space-y-5">{children}</div>
    </section>
  );
}
