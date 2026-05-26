import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Armenian } from "next/font/google";
import "./globals.css";

// ============================================================
// Typography — "Clean Slate"
//
// Geist (Vercel's sans) carries the entire UI — clean, geometric,
// highly readable. Geist Mono covers the rare tabular/code bits.
// Noto Sans Armenian is the per-character glyph fallback for hy
// (and any Cyrillic Geist lacks), wired through the CSS font stack
// in tailwind.config.ts so a single page can mix scripts without
// locale-aware classes.
// ============================================================

const geist = Geist({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-mono",
  display: "swap",
});

const notoSansArmenian = Noto_Sans_Armenian({
  subsets: ["armenian"],
  variable: "--font-noto-sans-armenian",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SoloOS — Career & Freelance OS",
  description:
    "Manage CVs, AI-generated cover letters and job applications in one workspace.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={[
        geist.variable,
        geistMono.variable,
        notoSansArmenian.variable,
      ].join(" ")}
    >
      <head>
        {/* No-flash theme init — blocking head script, runs before paint. */}
        <script src="/theme-init.js" />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
