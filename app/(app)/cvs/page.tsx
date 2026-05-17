import Link from "next/link";
import { FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// CVs landing — placeholder until the resume builder ships. The empty
// state is treated as a "coming soon" moment: gradient halo behind the
// icon, primary CTA, secondary hint pointing to cover letters as the
// today-shippable equivalent.
export default function CvsPage() {
  return (
    <div className="mx-auto flex max-w-[1080px] flex-col px-6 py-10 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 font-semibold tracking-tight">CVs</h1>
          <p className="pt-1 text-body text-secondary-foreground">
            Build, edit and export CVs in any language.
          </p>
        </div>
        <Button disabled>New CV</Button>
      </header>

      <section
        className={cn(
          "relative mt-10 flex flex-col items-center justify-center overflow-hidden rounded-2xl px-6 py-16 text-center",
          "glass-card",
        )}
      >
        {/* Spectral halo behind the icon — recolored from the page mesh. */}
        <div
          aria-hidden
          className={cn(
            "absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full opacity-60 blur-3xl",
            "bg-gradient-to-br from-primary/40 via-[hsl(var(--accent-violet))]/30 to-[hsl(var(--accent-cyan))]/20",
          )}
        />

        <div className="relative">
          <span
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl",
              "bg-gradient-to-br from-primary/15 to-[hsl(var(--accent-violet))]/15",
              "ring-1 ring-primary/30",
              "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.1),0_8px_24px_-8px_hsl(var(--primary)/0.4)]",
            )}
          >
            <FileText className="h-7 w-7 text-primary" />
          </span>
        </div>

        <h2 className="relative mt-6 text-h2 font-semibold tracking-tight">
          CV Builder is on the way
        </h2>
        <p className="relative mt-2 max-w-[44ch] text-small leading-relaxed text-muted-foreground">
          Section list, editable middle column, live preview, and PDF export
          with the canonical{" "}
          <span className="font-mono text-[12px]">
            First_Last_Position_CV_LANG.pdf
          </span>{" "}
          filename. Coming soon.
        </p>

        <div className="relative mt-7 flex flex-wrap items-center justify-center gap-2">
          <Button asChild size="lg">
            <Link href="/cover-letters/new">
              <Sparkles className="h-4 w-4" />
              Try cover letters instead
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/settings/profile">Polish your profile</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
