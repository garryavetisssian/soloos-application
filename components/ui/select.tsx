import * as React from "react";
import { cn } from "@/lib/utils";

// Native <select> — same glass treatment as Input + Textarea, with a
// custom caret rendered as an inline SVG background so it picks up the
// foreground color and stays crisp across zoom levels.
//
// Native option lists still render in the OS chrome (we don't control
// those visuals). The trigger is what matters for the redesign.
const CARET_DATA_URI =
  "data:image/svg+xml,%3Csvg%20width%3D'12'%20height%3D'8'%20viewBox%3D'0%200%2012%208'%20fill%3D'none'%20xmlns%3D'http%3A//www.w3.org/2000/svg'%3E%3Cpath%20d%3D'M1%201.5L6%206.5L11%201.5'%20stroke%3D'%23A1A1AA'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'/%3E%3C/svg%3E";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, style, ...props }, ref) => (
  <select
    ref={ref}
    style={{
      backgroundImage: `url("${CARET_DATA_URI}")`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 12px center",
      backgroundSize: "12px 8px",
      ...style,
    }}
    className={cn(
      "flex h-9 w-full appearance-none rounded-md pl-3 pr-9 py-1 text-body",
      "bg-surface/55 backdrop-blur-xl",
      "border border-white/[0.08]",
      "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.04)]",
      "transition-[border-color,box-shadow,background-color] duration-fast ease-out-quint",
      "focus-visible:outline-none focus-visible:bg-surface-elevated/70 focus-visible:border-primary/45 focus-visible:shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.06),0_0_0_3px_hsl(var(--primary)/0.18)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export { Select };
