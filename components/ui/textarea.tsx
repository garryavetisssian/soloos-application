import * as React from "react";
import { cn } from "@/lib/utils";

// Clean Slate textarea — same recipe as Input, sized for multi-line.
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-lg px-3 py-2 text-body",
        "bg-surface text-foreground border border-input",
        "transition-[border-color,box-shadow] duration-150 ease-out",
        "placeholder:text-muted-foreground/70",
        "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
