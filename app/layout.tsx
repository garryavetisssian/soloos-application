import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// One sans family across the app — Vercel's Geist. Modern, distinctively
// not Inter, high-legibility at every size. Carries Latin glyphs;
// Cyrillic and Armenian fall back to the system stack (fonts.google.com
// hosts Geist with Latin extended only).
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

// Geist Mono — used for metadata (UPPERCASE tracked eyebrows, tabular
// numbers in stats, status pills). Same family voice as the body font.
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
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
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
