import * as React from "react";
import { cn } from "@/lib/utils";

// Clean Slate native <select> — same surface treatment as Input, with
// a custom caret drawn as an inline SVG background. The caret uses a
// mid gray that reads on both light and dark surfaces.
const CARET_DATA_URI =
  "data:image/svg+xml,%3Csvg%20width%3D'12'%20height%3D'8'%20viewBox%3D'0%200%2012%208'%20fill%3D'none'%20xmlns%3D'http%3A//www.w3.org/2000/svg'%3E%3Cpath%20d%3D'M1%201.5L6%206.5L11%201.5'%20stroke%3D'%238A9491'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'/%3E%3C/svg%3E";

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
      "flex h-9 w-full appearance-none rounded-lg pl-3 pr-9 py-1 text-body",
      "bg-surface text-foreground border border-input",
      "transition-[border-color,box-shadow] duration-150 ease-out",
      "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
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
