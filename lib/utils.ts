import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Our Tailwind config defines custom font sizes with bare names
// (text-body, text-small, text-h1, …). Stock tailwind-merge doesn't know
// these are font-sizes, so it misclassifies them as text-color utilities
// and, when a class string has both (e.g. a button with `text-primary-
// foreground` + `text-body`), it drops one of them. Registering the names
// in the `font-size` group lets color and size coexist correctly.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "eyebrow",
            "folio",
            "label",
            "small",
            "body",
            "h3",
            "h2",
            "h1",
            "hero",
            "masthead",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
