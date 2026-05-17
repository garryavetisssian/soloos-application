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
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-geist)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-geist-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      fontSize: {
        small: ["13px", { lineHeight: "1.5" }],
        body: ["15px", { lineHeight: "1.6" }],
        h3: ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        h2: ["24px", { lineHeight: "1.25", fontWeight: "600" }],
        h1: ["32px", { lineHeight: "1.15", fontWeight: "600" }],
        hero: ["48px", { lineHeight: "1.08", fontWeight: "600" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "1.25rem",
      },
      boxShadow: {
        "glass-rest":
          "inset 0 1px 0 0 hsl(0 0% 100% / 0.05), 0 8px 24px -12px hsl(240 50% 5% / 0.55)",
        "glass-hover":
          "inset 0 1px 0 0 hsl(0 0% 100% / 0.08), 0 16px 36px -8px hsl(240 50% 5% / 0.6)",
        "primary-glow":
          "inset 0 1px 0 0 hsl(0 0% 100% / 0.18), 0 0 0 1px hsl(var(--primary) / 0.4), 0 8px 24px -8px hsl(var(--primary) / 0.5)",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "dropdown-in": "dropdown-in 180ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        "fade-in": "fade-in 200ms ease-out",
      },
    },
  },
  plugins: [animate],
};

export default config;
