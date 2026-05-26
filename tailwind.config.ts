import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        ink: "hsl(var(--ink))",
        paper: "hsl(var(--paper))",
        surface: {
          DEFAULT: "hsl(var(--surface))",
          elevated: "hsl(var(--surface-elevated))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        "bg-subtle": "hsl(var(--bg-subtle))",
        "accent-soft": "hsl(var(--accent-soft))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        rule: "hsl(var(--rule))",
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        cinnabar: {
          DEFAULT: "hsl(var(--cinnabar))",
          foreground: "hsl(var(--cinnabar-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
      },
      fontFamily: {
        // Clean Slate — Geist everywhere. `display` is kept as a token
        // (it now points at Geist) so legacy `font-display` callers
        // still resolve; the heavier weight is applied via the
        // .font-display helper class in globals.css.
        display: [
          "var(--font-geist)",
          "var(--font-noto-sans-armenian)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        sans: [
          "var(--font-geist)",
          "var(--font-noto-sans-armenian)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        // Mono — Geist Mono, for the rare bits of tabular/code text.
        mono: [
          "var(--font-geist-mono)",
          "var(--font-noto-sans-armenian)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      fontSize: {
        // Small tracked labels (legacy keys remapped to clean values).
        eyebrow: ["11px", { lineHeight: "1.4", letterSpacing: "0.08em" }],
        folio: ["12px", { lineHeight: "1.4", letterSpacing: "0.01em" }],
        // Body type scale.
        label: ["12px", { lineHeight: "1.4", letterSpacing: "0.01em" }],
        small: ["13px", { lineHeight: "1.55" }],
        body: ["15px", { lineHeight: "1.6" }],
        // Headline scale — clean sans, tight tracking, no theatrics.
        h3: ["18px", { lineHeight: "1.35", letterSpacing: "-0.01em" }],
        h2: ["22px", { lineHeight: "1.25", letterSpacing: "-0.015em" }],
        h1: ["28px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        hero: ["36px", { lineHeight: "1.1", letterSpacing: "-0.025em" }],
        // "masthead" retained as a token for landing/dashboard heroes,
        // brought down to a sane large size.
        masthead: ["44px", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
      },
      borderRadius: {
        // Editorial geometry — radii tighter, more architectural.
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
      },
      boxShadow: {
        // Soft Stripe-style elevation. Legacy keys kept (remapped) so
        // any stray `shadow-glass-*` callers degrade gracefully.
        xs: "0 1px 2px -1px hsl(165 24% 8% / 0.06)",
        sm: "0 1px 2px -1px hsl(165 24% 8% / 0.06), 0 2px 6px -2px hsl(165 24% 8% / 0.06)",
        md: "0 1px 2px -1px hsl(165 24% 8% / 0.06), 0 4px 16px -8px hsl(165 24% 8% / 0.1)",
        lg: "0 8px 24px -8px hsl(165 24% 8% / 0.14), 0 2px 6px -2px hsl(165 24% 8% / 0.08)",
        "glass-rest": "0 1px 2px -1px hsl(165 24% 8% / 0.06), 0 4px 16px -8px hsl(165 24% 8% / 0.08)",
        "glass-hover": "0 4px 12px -4px hsl(165 24% 8% / 0.1), 0 12px 32px -12px hsl(165 24% 8% / 0.12)",
        "primary-glow": "0 0 0 3px hsl(var(--primary) / 0.18)",
        "cinnabar-glow": "0 0 0 3px hsl(var(--cinnabar) / 0.18)",
        "ink-rule": "none",
      },
      transitionTimingFunction: {
        "out-quint": "cubic-bezier(0.22, 1, 0.36, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      transitionDuration: {
        fast: "150ms",
        medium: "250ms",
        slow: "400ms",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "dropdown-in": {
          from: { opacity: "0", transform: "translateY(-4px) scale(0.96)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "ink-bloom": {
          // Editorial entrance — settles like ink hitting paper.
          "0%": { opacity: "0", transform: "translateY(8px)", filter: "blur(2px)" },
          "60%": { opacity: "1", filter: "blur(0)" },
          "100%": { opacity: "1", transform: "translateY(0)", filter: "blur(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "dropdown-in": "dropdown-in 180ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        "fade-in": "fade-in 200ms ease-out",
        "ink-bloom": "ink-bloom 700ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [animate],
};

export default config;
