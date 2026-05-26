import * as React from "react";
import { cn } from "@/lib/utils";

// Clean Slate input — solid surface, hairline border, emerald focus
// ring. No glass/blur.
const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-lg px-3 py-1 text-body",
        "bg-surface text-foreground border border-input",
        "transition-[border-color,box-shadow] duration-150 ease-out",
        "file:border-0 file:bg-transparent file:text-small file:font-medium",
        "placeholder:text-muted-foreground/70",
        "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
