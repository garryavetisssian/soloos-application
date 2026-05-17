// URL → WorkLinkType classifier. Pattern-based, no network call.
// Patterns are intentionally conservative — when in doubt we fall to
// "portfolio" (generic site) so the validator still runs a normal HTML
// fetch instead of a platform-specific check.

import type { WorkLinkType } from "./types";

interface Rule {
  type: WorkLinkType;
  test: (host: string, pathname: string) => boolean;
}

const RULES: Rule[] = [
  // GitHub — both repos and profile pages. Gist is treated as github too.
  {
    type: "github",
    test: (h) => h === "github.com" || h === "www.github.com" || h === "gist.github.com",
  },
  {
    type: "figma",
    test: (h) => h === "figma.com" || h === "www.figma.com",
  },
  {
    type: "dribbble",
    test: (h) => h === "dribbble.com" || h === "www.dribbble.com",
  },
  {
    type: "behance",
    test: (h) => h === "behance.net" || h === "www.behance.net",
  },
  // App / Play stores → "app_store" covers both.
  {
    type: "app_store",
    test: (h) =>
      h === "apps.apple.com" ||
      h === "play.google.com" ||
      h === "itch.io" ||
      h.endsWith(".itch.io"),
  },
  // YouTube + Vimeo
  {
    type: "video",
    test: (h) =>
      h === "youtube.com" ||
      h === "www.youtube.com" ||
      h === "youtu.be" ||
      h === "vimeo.com" ||
      h === "www.vimeo.com",
  },
  // Article platforms — known blogging hosts.
  {
    type: "article",
    test: (h) =>
      h === "medium.com" ||
      h.endsWith(".medium.com") ||
      h === "substack.com" ||
      h.endsWith(".substack.com") ||
      h === "dev.to" ||
      h === "hashnode.com" ||
      h.endsWith(".hashnode.dev") ||
      h.endsWith(".notion.site") ||
      h === "notion.site",
  },
];

export function classifyUrl(url: string): WorkLinkType {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "other";
  }
  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;
  for (const rule of RULES) {
    if (rule.test(host, pathname)) return rule.type;
  }
  // Default — assume it's a personal site / portfolio. Generic HTML
  // fetch will tell us if it's actually reachable.
  return "portfolio";
}
