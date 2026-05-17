import Link from "next/link";
import { ArrowRight, Briefcase, Check, FileText, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// SoloOS landing — modern, clean, dark.
// Single hero with a tight headline + lede, two CTAs, three feature
// cards with glass treatment and hover lifts, and a clear footer.
//
// Reads ?signedout=1 from the URL (set by /auth/signout) to render a
// brief confirmation banner so the user knows the logout took effect.
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ signedout?: string }>;
}) {
  const params = await searchParams;
  const justSignedOut = params.signedout === "1";

  return (
    <main className="relative min-h-screen overflow-hidden">
      {justSignedOut && (
        <div
          role="status"
          className={cn(
            "fixed left-1/2 top-4 z-50 -translate-x-1/2 animate-dropdown-in",
            "flex items-center gap-2.5 rounded-full px-4 py-2",
            "glass-popover text-small text-foreground",
          )}
        >
          <span
            aria-hidden
            className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20 text-success"
          >
            <Check className="h-3 w-3" />
          </span>
          You&apos;ve been signed out.
        </div>
      )}

      {/* ----- Chrome ----- */}
      <header className="relative z-10 mx-auto flex h-16 max-w-[1200px] items-center justify-between px-8">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "h-7 w-7 rounded-md",
              "bg-gradient-to-br from-primary to-[hsl(var(--accent-violet))]",
              "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.25),0_4px_14px_-4px_hsl(var(--primary)/0.55)]",
            )}
          />
          <span className="text-h3 font-semibold tracking-tight text-foreground">
            SoloOS
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/login">Get started</Link>
          </Button>
        </nav>
      </header>

      {/* ----- Hero ----- */}
      <section className="relative z-10 mx-auto max-w-[1200px] px-8 pt-20 pb-24 sm:pt-28">
        <div className="reveal max-w-[760px]">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1",
              "bg-primary/12 border border-primary/25",
              "text-[12px] font-medium text-primary",
            )}
          >
            <Sparkles className="h-3 w-3" />
            Career &amp; Freelance OS
          </span>

          <h1 className="mt-6 text-hero font-semibold tracking-tight text-foreground">
            One workspace for your{" "}
            <span className="bg-gradient-to-r from-primary via-[hsl(var(--accent-violet))] to-[hsl(var(--accent-cyan))] bg-clip-text text-transparent">
              entire job search
            </span>
            .
          </h1>

          <p className="mt-6 max-w-[58ch] text-body leading-relaxed text-secondary-foreground">
            Build CVs, generate tailored cover letters with AI, and track every
            application in one opinionated workflow. No more juggling docs,
            spreadsheets, and email drafts.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#features">See what&apos;s inside</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ----- Features ----- */}
      <section
        id="features"
        className="relative z-10 mx-auto max-w-[1200px] px-8 pb-24"
      >
        <div className="mb-10 max-w-[640px]">
          <span className="eyebrow">What&apos;s inside</span>
          <h2 className="mt-3 text-h1 font-semibold tracking-tight text-foreground">
            Three surfaces.{" "}
            <span className="text-muted-foreground">One flow.</span>
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<FileText className="h-5 w-5" />}
            title="CV Builder"
            body="Section list, editable centre, live preview. Export as a polished PDF with a canonical filename."
            accent="cyan"
          />
          <FeatureCard
            icon={<Mail className="h-5 w-5" />}
            title="AI Cover Letters"
            body="Paste a job link or description. Get a tailored letter that weaves your portfolio in naturally."
            accent="primary"
            highlighted
          />
          <FeatureCard
            icon={<Briefcase className="h-5 w-5" />}
            title="Job Tracker"
            body="Kanban from saved to offer. Add jobs from any platform; everything fits one pipeline."
            accent="violet"
          />
        </div>
      </section>

      {/* ----- Footer ----- */}
      <footer className="relative z-10 mx-auto max-w-[1200px] px-8 pb-10">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-small text-muted-foreground">
          <span>SoloOS — Career &amp; Freelance OS</span>
          <span className="font-mono text-[11px] uppercase tracking-wider">
            Next · Supabase · Gemini
          </span>
        </div>
      </footer>
    </main>
  );
}

const ACCENT: Record<
  "primary" | "cyan" | "violet",
  { bg: string; text: string; ring: string }
> = {
  primary: {
    bg: "bg-primary/12",
    text: "text-primary",
    ring: "ring-primary/30",
  },
  cyan: {
    bg: "bg-cyan-500/12",
    text: "text-cyan-400",
    ring: "ring-cyan-500/30",
  },
  violet: {
    bg: "bg-violet-500/12",
    text: "text-violet-400",
    ring: "ring-violet-500/30",
  },
};

function FeatureCard({
  icon,
  title,
  body,
  accent,
  highlighted = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  accent: "primary" | "cyan" | "violet";
  highlighted?: boolean;
}) {
  const a = ACCENT[accent];
  return (
    <div
      className={cn(
        "glass-card lift-on-hover group relative p-6",
        highlighted && "ring-1",
        highlighted && a.ring,
      )}
    >
      <span
        className={cn(
          "relative z-10 flex h-10 w-10 items-center justify-center rounded-lg",
          a.bg,
          a.text,
          "ring-1",
          a.ring,
        )}
      >
        {icon}
      </span>
      <h3 className="relative z-10 mt-5 text-h3 font-semibold text-foreground">
        {title}
      </h3>
      <p className="relative z-10 mt-2 text-small leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
