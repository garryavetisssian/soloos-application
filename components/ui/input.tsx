import * as React from "react";
import { cn } from "@/lib/utils";

// Glass input: translucent surface + blur + hairline at rest;
// indigo-tinted border + soft outer glow on focus. The hairline
// uses a solid 8% white border (not the gradient pseudo) because
// native <input> doesn't reliably render ::before across browsers
// at thin widths — the visual difference is negligible.
const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md px-3 py-1 text-body",
        "bg-surface/55 backdrop-blur-xl",
        "border border-white/[0.08]",
        "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.04)]",
        "transition-[border-color,box-shadow,background-color] duration-fast ease-out-quint",
        "file:border-0 file:bg-transparent file:text-small file:font-medium",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:bg-surface-elevated/70 focus-visible:border-primary/45 focus-visible:shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.06),0_0_0_3px_hsl(var(--primary)/0.18)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
