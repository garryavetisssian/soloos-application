import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Modern dark button system.
// - default (primary): solid indigo fill, inset top highlight, indigo
//   drop shadow that grows on hover.
// - secondary / outline: glass translucent surface.
// - ghost: transparent rest, glass fill on hover.
// - destructive: brick red, same recipe as primary.
// - link: text-only, gradient underline on hover.
//
// All variants share the same motion: 150ms ease-out-quint on
// transform/shadow/background, -1px translate on hover, 0 on active.
const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-small font-medium",
    "transition-[transform,box-shadow,background-color,color] duration-fast ease-out-quint",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        default: cn(
          "bg-primary text-primary-foreground shadow-primary-glow",
          "hover:-translate-y-px hover:bg-primary/95 hover:shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.22),0_0_0_1px_hsl(var(--primary)/0.55),0_14px_30px_-6px_hsl(var(--primary)/0.6)]",
          "active:translate-y-0 active:shadow-primary-glow",
        ),
        secondary: cn(
          "bg-surface/55 text-foreground backdrop-blur-xl",
          "border border-white/[0.08]",
          "shadow-glass-rest",
          "hover:-translate-y-px hover:bg-surface-elevated/70 hover:shadow-glass-hover hover:border-white/[0.14]",
        ),
        outline: cn(
          "bg-surface/40 text-foreground backdrop-blur-md",
          "border border-white/[0.12]",
          "hover:-translate-y-px hover:bg-surface-elevated/60 hover:border-white/[0.20] hover:shadow-glass-hover",
        ),
        ghost: cn(
          "bg-transparent text-foreground",
          "hover:bg-surface-elevated/70 hover:backdrop-blur-md",
        ),
        destructive: cn(
          "bg-destructive text-destructive-foreground",
          "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.18),0_4px_14px_-4px_hsl(var(--destructive)/0.5)]",
          "hover:-translate-y-px hover:bg-destructive/95 hover:shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.22),0_14px_30px_-6px_hsl(var(--destructive)/0.6)]",
        ),
        link: cn(
          "text-primary underline-offset-4",
          "hover:underline hover:text-primary/90",
        ),
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3",
        lg: "h-11 px-7 text-body",
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
