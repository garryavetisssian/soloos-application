import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Clean Slate button system. Variant names are unchanged so existing
// callers keep working:
//   - default (primary): solid emerald
//   - cinnabar: teal accent fill (kept as an opt-in alt accent)
//   - secondary / outline: subtle bordered surface
//   - ghost: transparent → soft tint on hover
//   - destructive: red
//   - link: emerald underlined inline link
const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg",
    "text-small font-medium",
    "transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        default: cn(
          "bg-primary text-primary-foreground shadow-sm",
          "hover:bg-primary/90 active:bg-primary/95",
        ),
        cinnabar: cn(
          "bg-cinnabar text-cinnabar-foreground shadow-sm",
          "hover:bg-cinnabar/90 active:bg-cinnabar/95",
        ),
        secondary: cn(
          "bg-surface text-foreground border border-border shadow-xs",
          "hover:bg-surface-elevated hover:border-border",
        ),
        outline: cn(
          "bg-transparent text-foreground border border-border",
          "hover:bg-surface-elevated",
        ),
        ghost: cn(
          "bg-transparent text-foreground",
          "hover:bg-surface-elevated",
        ),
        destructive: cn(
          "bg-destructive text-destructive-foreground shadow-sm",
          "hover:bg-destructive/90",
        ),
        link: cn(
          "text-primary underline decoration-primary/30 underline-offset-4",
          "hover:decoration-primary",
        ),
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-11 px-6 text-body",
        xl: "h-12 px-7 text-body",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
