import * as React from "react";
import { cn } from "@/lib/utils";

// Same recipe as Input — translucent surface + blur + hairline,
// with the indigo focus glow. Sized for multi-line content.
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-md px-3 py-2 text-body",
        "bg-surface/55 backdrop-blur-xl",
        "border border-white/[0.08]",
        "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.04)]",
        "transition-[border-color,box-shadow,background-color] duration-fast ease-out-quint",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:bg-surface-elevated/70 focus-visible:border-primary/45 focus-visible:shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.06),0_0_0_3px_hsl(var(--primary)/0.18)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
