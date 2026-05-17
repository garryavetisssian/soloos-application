import type { Language } from "@/lib/types";

function slug(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

export function cvFilename(opts: {
  firstName: string;
  lastName: string;
  position: string;
  language: Language;
}) {
  const lang = opts.language.toUpperCase();
  return `${slug(opts.firstName)}_${slug(opts.lastName)}_${slug(opts.position)}_CV_${lang}.pdf`;
}
