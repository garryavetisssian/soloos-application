import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronRight,
  Globe,
  Link2,
  Mail,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// SoloOS landing — full marketing surface.
// Sections (top → bottom):
//   1. Hero with CTA + a stylized "cover letter being composed" mockup
//   2. Persona marquee — who SoloOS is built for
//   3. "How it works" — 3 numbered steps
//   4. Feature 1: AI cover letters — text left, mockup right
//   5. Feature 2: Job pipeline — mockup left, text right
//   6. Feature 3: Portfolio links — text left, mockup right
//   7. Numbers strip — modules / languages / lines saved
//   8. Final CTA band
//   9. Footer
//
// Scroll reveals via CSS `animation-timeline: view()` (modern browsers).
// On older browsers, sections render fully visible — graceful fallback.
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ signedout?: string }>;
}) {
  const params = await searchParams;
  const justSignedOut = params.signedout === "1";

  return (
    <main className="relative min-h-screen overflow-hidden">
      {justSignedOut && <SignedOutToast />}

      <NavBar />

      <Hero />

      <PersonaStrip />

      <HowItWorks />

      <FeatureCoverLetters />

      <FeatureJobs />

      <FeatureLinks />

      <NumbersStrip />

      <CtaBand />

      <Footer />
    </main>
  );
}

// ===================================================================
// Toast — signed out confirmation
// ===================================================================
function SignedOutToast() {
  return (
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
  );
}

// ===================================================================
// Nav bar
// ===================================================================
function NavBar() {
  return (
    <header className="relative z-20 mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6 sm:px-8">
      <Link href="/" className="group flex items-center gap-2.5">
        <Image
          src="/logo-icon.png"
          alt=""
          width={589}
          height={223}
          priority
          className={cn(
            "h-7 w-auto",
            "transition-transform duration-fast ease-out-quint",
            "group-hover:scale-[1.06]",
          )}
        />
        <span className="text-h3 font-semibold tracking-tight text-foreground">
          SoloOS
        </span>
      </Link>
      <nav className="flex items-center gap-1.5">
        <Button asChild variant="ghost" size="sm">
          <Link href="#features">Features</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="#how">How it works</Link>
        </Button>
        <span className="mx-2 hidden h-4 w-px bg-white/[0.08] sm:block" />
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">Log in</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/login">
            Get started
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </nav>
    </header>
  );
}

// ===================================================================
// Hero
// ===================================================================
function Hero() {
  return (
    <section className="relative z-10 mx-auto max-w-[1200px] px-6 pt-16 pb-20 sm:px-8 sm:pt-24">
      <div className="reveal grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div className="max-w-[640px]">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1",
              "bg-primary/10 border border-primary/25",
              "text-[12px] font-medium text-primary",
            )}
          >
            <Sparkles className="h-3 w-3" />
            Career &amp; Freelance OS
          </span>
          <h1 className="mt-6 text-[42px] font-semibold leading-[1.05] tracking-tight text-foreground sm:text-hero">
            One workspace for your{" "}
            <span className="bg-gradient-to-r from-primary via-[hsl(var(--accent-violet))] to-[hsl(var(--accent-cyan))] bg-clip-text text-transparent">
              entire job search
            </span>
            .
          </h1>
          <p className="mt-6 max-w-[58ch] text-body leading-relaxed text-secondary-foreground">
            Build CVs, generate tailored cover letters with AI, and track every
            application — in one opinionated workflow. No more juggling docs,
            spreadsheets, and email drafts.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#how">See how it works</Link>
            </Button>
          </div>
          <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-small text-muted-foreground">
            <Bullet>Free to start</Bullet>
            <Bullet>Google sign-in</Bullet>
            <Bullet>English · Русский · Հայերեն</Bullet>
          </ul>
        </div>
        <HeroMockup />
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
      {children}
    </li>
  );
}

// Stylized "cover letter being composed" mockup. Three stacked glass
// cards: the top one carries the AI tone toolbar, the middle one shows
// a rendered letter snippet, the bottom one shows the saved-to-library
// confirmation. All built with divs + Tailwind — zero raster images.
function HeroMockup() {
  return (
    <div className="relative mx-auto h-[460px] w-full max-w-[520px]">
      {/* Decorative glow halo behind the stack. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10 rounded-full opacity-70 blur-3xl",
          "bg-gradient-to-br from-primary/35 via-[hsl(var(--accent-violet))]/25 to-[hsl(var(--accent-cyan))]/20",
        )}
      />

      {/* Saved-letter pill — bottom-right, slight rotate. */}
      <div
        className={cn(
          "absolute bottom-2 right-4 w-[230px] rotate-[3deg] p-3",
          "glass-popover",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-success/20 text-success">
            <Check className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-small font-medium text-foreground">
              Saved to library
            </div>
            <div className="truncate text-[12px] text-muted-foreground">
              Acme · Senior Product Designer
            </div>
          </div>
        </div>
      </div>

      {/* Compose card — center, the focal mock. */}
      <div
        className={cn(
          "absolute left-1/2 top-1/2 w-[420px] -translate-x-1/2 -translate-y-1/2 -rotate-[2deg] p-5",
          "glass-popover",
        )}
      >
        <div className="flex items-center justify-between gap-3 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-500/20 text-violet-300">
              <Mail className="h-3.5 w-3.5" />
            </span>
            <span className="text-small font-medium text-foreground">
              Cover letter
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            EN · AI
          </span>
        </div>
        <div className="space-y-2 rounded-md bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
          <div className="h-2 w-[88%] rounded-full bg-white/[0.10]" />
          <div className="h-2 w-[72%] rounded-full bg-white/[0.07]" />
          <div className="h-2 w-[94%] rounded-full bg-white/[0.10]" />
          <div className="h-2 w-[64%] rounded-full bg-white/[0.07]" />
          <div className="h-2 w-[80%] rounded-full bg-white/[0.10]" />
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <ToolChip>Make stronger</ToolChip>
          <ToolChip>Shorten</ToolChip>
          <ToolChip>Translate</ToolChip>
        </div>
      </div>

      {/* Job pipeline mini — top-left, slight rotate. */}
      <div
        className={cn(
          "absolute left-4 top-4 w-[260px] -rotate-[4deg] p-3",
          "glass-popover",
        )}
      >
        <div className="flex items-center gap-2 pb-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/20 text-cyan-300">
            <Briefcase className="h-3 w-3" />
          </span>
          <span className="text-small font-medium text-foreground">
            Pipeline
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          <PipelineMini label="Saved" n={4} />
          <PipelineMini label="Applied" n={2} accent="cyan" />
          <PipelineMini label="Interview" n={1} accent="primary" />
          <PipelineMini label="Offer" n={0} accent="emerald" />
        </div>
      </div>
    </div>
  );
}

function ToolChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
        "border border-white/[0.08] bg-white/[0.03]",
        "text-[11px] text-muted-foreground",
      )}
    >
      <Wand2 className="h-2.5 w-2.5" />
      {children}
    </span>
  );
}

function PipelineMini({
  label,
  n,
  accent,
}: {
  label: string;
  n: number;
  accent?: "cyan" | "primary" | "emerald";
}) {
  const tint =
    accent === "cyan"
      ? "text-cyan-400"
      : accent === "primary"
        ? "text-primary"
        : accent === "emerald"
          ? "text-emerald-400"
          : "text-foreground";
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.03] p-1.5 text-center">
      <div className={cn("text-body font-semibold tabular-nums", tint)}>
        {n}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

// ===================================================================
// Persona marquee
// ===================================================================
function PersonaStrip() {
  const personas = [
    "Designers",
    "Developers",
    "Product managers",
    "Marketers",
    "Freelancers",
    "Founders",
    "Remote job seekers",
    "Recent grads",
  ];
  // Doubled so the loop is seamless when translateX -50%.
  const loop = [...personas, ...personas];
  return (
    <section className="scroll-reveal relative z-10 border-y border-white/[0.04] bg-white/[0.015] py-7">
      <p className="eyebrow mx-auto max-w-[1200px] px-6 pb-3 sm:px-8">
        Built for
      </p>
      <div className="marquee-mask overflow-hidden">
        <div className="marquee-track">
          {loop.map((p, i) => (
            <span
              key={`${p}-${i}`}
              className="flex items-center gap-3 px-6 text-h3 font-medium text-muted-foreground/80"
            >
              {p}
              <span
                aria-hidden
                className="h-1 w-1 rounded-full bg-muted-foreground/40"
              />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================================================================
// How it works
// ===================================================================
function HowItWorks() {
  return (
    <section
      id="how"
      className="scroll-reveal relative z-10 mx-auto max-w-[1200px] px-6 py-24 sm:px-8"
    >
      <div className="mx-auto max-w-[640px] text-center">
        <span className="eyebrow">
          <span aria-hidden className="mr-1.5 inline-block h-1 w-1 rounded-full bg-primary align-middle" />
          How it works
        </span>
        <h2 className="mt-3 text-h1 font-semibold tracking-tight text-foreground">
          From one job posting to a sent application{" "}
          <span className="text-muted-foreground">in minutes.</span>
        </h2>
      </div>

      <ol className="mt-12 grid gap-4 md:grid-cols-3">
        <Step
          num="01"
          icon={<Sparkles className="h-5 w-5" />}
          accent="primary"
          title="Tell us about you, once."
          body="A guided profile captures your skills, target roles, tools, and portfolio links. Or upload a CV — we'll extract it."
        />
        <Step
          num="02"
          icon={<Search className="h-5 w-5" />}
          accent="violet"
          title="Paste any job link."
          body="SoloOS reads the page — company, role, requirements — and writes a letter that weaves in your portfolio."
        />
        <Step
          num="03"
          icon={<Briefcase className="h-5 w-5" />}
          accent="cyan"
          title="Track and follow up."
          body="Save the letter, log the application, and move it through Applied → Interview → Offer as it progresses."
        />
      </ol>
    </section>
  );
}

const STEP_ACCENT: Record<
  "primary" | "violet" | "cyan",
  { iconBg: string; iconText: string; ring: string }
> = {
  primary: {
    iconBg: "bg-primary/15",
    iconText: "text-primary",
    ring: "ring-primary/30",
  },
  violet: {
    iconBg: "bg-violet-500/15",
    iconText: "text-violet-400",
    ring: "ring-violet-500/30",
  },
  cyan: {
    iconBg: "bg-cyan-500/15",
    iconText: "text-cyan-400",
    ring: "ring-cyan-500/30",
  },
};

function Step({
  num,
  icon,
  accent,
  title,
  body,
}: {
  num: string;
  icon: React.ReactNode;
  accent: "primary" | "violet" | "cyan";
  title: string;
  body: string;
}) {
  const a = STEP_ACCENT[accent];
  return (
    <li className="glass-card relative p-6 lift-on-hover">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl ring-1",
            a.iconBg,
            a.iconText,
            a.ring,
          )}
        >
          {icon}
        </span>
        <span className="font-mono text-[11px] uppercase tabular-nums tracking-wider text-muted-foreground">
          {num}
        </span>
      </div>
      <h3 className="mt-5 text-h3 font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-small leading-relaxed text-muted-foreground">
        {body}
      </p>
    </li>
  );
}

// ===================================================================
// Feature: AI cover letters
// ===================================================================
function FeatureCoverLetters() {
  return (
    <section
      id="features"
      className="scroll-reveal relative z-10 mx-auto max-w-[1200px] px-6 py-24 sm:px-8"
    >
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div className="max-w-[520px]">
          <span className="eyebrow">
            <span aria-hidden className="mr-1.5 inline-block h-1 w-1 rounded-full bg-violet-400 align-middle" />
            AI cover letters
          </span>
          <h2 className="mt-3 text-h1 font-semibold tracking-tight text-foreground">
            Tailored letters{" "}
            <span className="text-muted-foreground">
              that actually mention the company.
            </span>
          </h2>
          <p className="mt-5 text-body leading-relaxed text-secondary-foreground">
            Paste a job URL — SoloOS reads the page, extracts the company,
            role, and product context, and weaves your portfolio links in
            where they fit. Pick a tone, switch channels (formal vs
            LinkedIn DM), translate, and ship.
          </p>
          <ul className="mt-6 space-y-2.5 text-small text-foreground">
            <FeatureBullet>Reads job pages including hh.ru</FeatureBullet>
            <FeatureBullet>4 tone variants + Make shorter / Make stronger</FeatureBullet>
            <FeatureBullet>Channels: formal posting vs direct DM</FeatureBullet>
            <FeatureBullet>Output in English, Russian, Armenian</FeatureBullet>
          </ul>
        </div>
        <CoverLetterMockup />
      </div>
    </section>
  );
}

// Larger compose mockup with letter body + AI action row.
function CoverLetterMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div
        aria-hidden
        className="absolute inset-x-8 inset-y-6 -z-10 rounded-3xl bg-gradient-to-br from-violet-500/30 via-primary/20 to-cyan-500/20 blur-3xl"
      />
      <div className="glass-popover relative overflow-hidden p-6">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30">
              <Mail className="h-4 w-4" />
            </span>
            <div>
              <div className="text-small font-medium text-foreground">
                Senior Product Designer
              </div>
              <div className="text-[12px] text-muted-foreground">
                Stripe · stripe.com/jobs/...
              </div>
            </div>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Generated 2s ago
          </span>
        </div>
        <div className="space-y-2 py-5">
          {LINES.map((w, i) => (
            <div
              key={i}
              className="h-2 rounded-full bg-white/[0.08]"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-4">
          <ToneTag tone="Confident" active />
          <ToneTag tone="Friendly" />
          <ToneTag tone="Formal" />
          <ToneTag tone="Startup" />
          <div className="ml-auto flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                "border border-white/[0.08] bg-white/[0.03]",
                "text-[11px] text-muted-foreground",
              )}
            >
              <Globe className="h-2.5 w-2.5" />
              EN
            </span>
            <Button size="sm">
              <Sparkles className="h-3 w-3" />
              Regenerate
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const LINES = [92, 78, 88, 64, 80, 72, 86, 58];

function ToneTag({ tone, active = false }: { tone: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        active
          ? "bg-primary/15 text-primary ring-1 ring-primary/30"
          : "bg-white/[0.03] text-muted-foreground ring-1 ring-white/[0.06]",
      )}
    >
      {tone}
    </span>
  );
}

function FeatureBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden
        className="mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary"
      >
        <Check className="h-2.5 w-2.5" />
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

// ===================================================================
// Feature: Job pipeline
// ===================================================================
function FeatureJobs() {
  return (
    <section className="scroll-reveal relative z-10 mx-auto max-w-[1200px] px-6 py-24 sm:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <KanbanMockup />
        <div className="max-w-[520px]">
          <span className="eyebrow">
            <span aria-hidden className="mr-1.5 inline-block h-1 w-1 rounded-full bg-cyan-400 align-middle" />
            Job tracker
          </span>
          <h2 className="mt-3 text-h1 font-semibold tracking-tight text-foreground">
            One pipeline,{" "}
            <span className="text-muted-foreground">every platform.</span>
          </h2>
          <p className="mt-5 text-body leading-relaxed text-secondary-foreground">
            LinkedIn, Indeed, Upwork, Glassdoor, a Telegram channel — they all
            land in the same Kanban. See exactly where you stand across every
            application without bouncing between spreadsheets.
          </p>
          <ul className="mt-6 space-y-2.5 text-small text-foreground">
            <FeatureBullet>5 stages — Saved → Applied → Interview → Offer → Rejected</FeatureBullet>
            <FeatureBullet>Notes, links, and the letter you sent — all together</FeatureBullet>
            <FeatureBullet>Dashboard shows what&apos;s active at a glance</FeatureBullet>
          </ul>
        </div>
      </div>
    </section>
  );
}

function KanbanMockup() {
  const columns: Array<{
    title: string;
    accent: "muted" | "cyan" | "primary" | "emerald";
    cards: { company: string; role: string }[];
  }> = [
    {
      title: "Saved",
      accent: "muted",
      cards: [
        { company: "Linear", role: "Senior Designer" },
        { company: "Arc", role: "Web Engineer" },
      ],
    },
    {
      title: "Applied",
      accent: "cyan",
      cards: [
        { company: "Stripe", role: "Product Designer" },
        { company: "Vercel", role: "Design Engineer" },
      ],
    },
    {
      title: "Interview",
      accent: "primary",
      cards: [{ company: "Notion", role: "Senior Designer" }],
    },
    {
      title: "Offer",
      accent: "emerald",
      cards: [],
    },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[620px]">
      <div
        aria-hidden
        className="absolute inset-x-6 inset-y-4 -z-10 rounded-3xl bg-gradient-to-br from-cyan-500/30 via-primary/20 to-violet-500/15 blur-3xl"
      />
      <div className="glass-popover overflow-hidden p-4">
        <div className="grid grid-cols-4 gap-2">
          {columns.map((col) => (
            <KanbanColumn key={col.title} {...col} />
          ))}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({
  title,
  accent,
  cards,
}: {
  title: string;
  accent: "muted" | "cyan" | "primary" | "emerald";
  cards: { company: string; role: string }[];
}) {
  const dot =
    accent === "cyan"
      ? "bg-cyan-400 shadow-[0_0_6px_0_hsl(190_91%_62%/0.7)]"
      : accent === "primary"
        ? "bg-primary shadow-[0_0_6px_0_hsl(var(--primary)/0.7)]"
        : accent === "emerald"
          ? "bg-emerald-400 shadow-[0_0_6px_0_hsl(158_64%_52%/0.7)]"
          : "bg-muted-foreground";
  const text =
    accent === "cyan"
      ? "text-cyan-400"
      : accent === "primary"
        ? "text-primary"
        : accent === "emerald"
          ? "text-emerald-400"
          : "text-muted-foreground";
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-white/[0.02] p-2 ring-1 ring-white/[0.05]">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span aria-hidden className={cn("h-1 w-1 rounded-full", dot)} />
          <span className={cn("text-[11px] font-medium", text)}>{title}</span>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {cards.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {cards.map((c, i) => (
          <div
            key={i}
            className={cn(
              "rounded-md p-2",
              "border border-white/[0.06] bg-white/[0.03]",
            )}
          >
            <div className="truncate text-[11px] font-medium text-foreground">
              {c.company}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">
              {c.role}
            </div>
          </div>
        ))}
        {cards.length === 0 && (
          <div className="rounded-md border border-dashed border-white/[0.06] bg-transparent p-2 text-center text-[10px] text-muted-foreground/60">
            Empty
          </div>
        )}
      </div>
    </div>
  );
}

// ===================================================================
// Feature: Portfolio links
// ===================================================================
function FeatureLinks() {
  return (
    <section className="scroll-reveal relative z-10 mx-auto max-w-[1200px] px-6 py-24 sm:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div className="max-w-[520px]">
          <span className="eyebrow">
            <span aria-hidden className="mr-1.5 inline-block h-1 w-1 rounded-full bg-emerald-400 align-middle" />
            Portfolio links
          </span>
          <h2 className="mt-3 text-h1 font-semibold tracking-tight text-foreground">
            Drop a URL.{" "}
            <span className="text-muted-foreground">
              We do the writing.
            </span>
          </h2>
          <p className="mt-5 text-body leading-relaxed text-secondary-foreground">
            GitHub repos, public Figma files, articles, App Store listings —
            paste the link and SoloOS auto-classifies, fetches, and summarises
            it. That context flows into every cover letter, automatically.
          </p>
          <ul className="mt-6 space-y-2.5 text-small text-foreground">
            <FeatureBullet>9 link types auto-classified</FeatureBullet>
            <FeatureBullet>Quality scoring blocks weak links from cover letters</FeatureBullet>
            <FeatureBullet>Editable summary + per-link &ldquo;use in cover letter&rdquo; toggle</FeatureBullet>
          </ul>
        </div>
        <LinksMockup />
      </div>
    </section>
  );
}

function LinksMockup() {
  const items: Array<{
    icon: React.ReactNode;
    title: string;
    domain: string;
    tag: string;
    accent: "primary" | "cyan" | "violet" | "emerald";
  }> = [
    {
      icon: <Briefcase className="h-3.5 w-3.5" />,
      title: "Personal portfolio",
      domain: "garry.design",
      tag: "Portfolio",
      accent: "primary",
    },
    {
      icon: <Link2 className="h-3.5 w-3.5" />,
      title: "Design system case study",
      domain: "figma.com/file/...",
      tag: "Figma",
      accent: "violet",
    },
    {
      icon: <Link2 className="h-3.5 w-3.5" />,
      title: "ruv-fann · neural agents",
      domain: "github.com/...",
      tag: "GitHub",
      accent: "cyan",
    },
    {
      icon: <Link2 className="h-3.5 w-3.5" />,
      title: "Notes from shipping SoloOS",
      domain: "garryslist.org/...",
      tag: "Article",
      accent: "emerald",
    },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div
        aria-hidden
        className="absolute inset-x-6 inset-y-4 -z-10 rounded-3xl bg-gradient-to-br from-emerald-500/25 via-primary/20 to-cyan-500/20 blur-3xl"
      />
      <div className="glass-popover space-y-2 p-4">
        {items.map((item, i) => (
          <LinkRow key={i} {...item} />
        ))}
      </div>
    </div>
  );
}

function LinkRow({
  icon,
  title,
  domain,
  tag,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  domain: string;
  tag: string;
  accent: "primary" | "cyan" | "violet" | "emerald";
}) {
  const tints: Record<typeof accent, { bg: string; text: string; ring: string }> = {
    primary: {
      bg: "bg-primary/15",
      text: "text-primary",
      ring: "ring-primary/30",
    },
    cyan: {
      bg: "bg-cyan-500/15",
      text: "text-cyan-400",
      ring: "ring-cyan-500/30",
    },
    violet: {
      bg: "bg-violet-500/15",
      text: "text-violet-400",
      ring: "ring-violet-500/30",
    },
    emerald: {
      bg: "bg-emerald-500/15",
      text: "text-emerald-400",
      ring: "ring-emerald-500/30",
    },
  };
  const a = tints[accent];
  return (
    <div className="flex items-center gap-3 rounded-md border border-white/[0.06] bg-white/[0.03] p-3 transition-colors duration-fast hover:bg-white/[0.06]">
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md ring-1",
          a.bg,
          a.text,
          a.ring,
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-small font-medium text-foreground">
          {title}
        </div>
        <div className="truncate text-[12px] text-muted-foreground">
          {domain}
        </div>
      </div>
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5",
          a.bg,
          a.text,
          "text-[10px] font-medium uppercase tracking-wider",
        )}
      >
        {tag}
      </span>
    </div>
  );
}

// ===================================================================
// Numbers strip
// ===================================================================
function NumbersStrip() {
  const stats = [
    { value: "3", label: "Modules — CVs, Cover letters, Jobs" },
    { value: "3", label: "Languages — EN · RU · HY" },
    { value: "9", label: "Portfolio link types auto-classified" },
    { value: "<2s", label: "Avg. time to first generated letter" },
  ];
  return (
    <section className="scroll-reveal relative z-10 border-y border-white/[0.04] bg-white/[0.015] py-12">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 px-6 sm:px-8 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center md:text-left">
            <div
              className={cn(
                "text-hero font-semibold tabular-nums tracking-tight",
                "bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent",
              )}
            >
              {s.value}
            </div>
            <div className="mt-1.5 text-small text-muted-foreground">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ===================================================================
// CTA band
// ===================================================================
function CtaBand() {
  return (
    <section className="scroll-reveal relative z-10 mx-auto max-w-[1200px] px-6 py-24 sm:px-8">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl px-8 py-14 text-center sm:px-12 sm:py-20",
          "glass-card",
        )}
      >
        <div
          aria-hidden
          className={cn(
            "absolute -top-1/2 left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full opacity-60 blur-3xl",
            "bg-gradient-to-br from-primary/40 via-[hsl(var(--accent-violet))]/30 to-[hsl(var(--accent-cyan))]/20",
          )}
        />
        <div className="relative">
          <span className="eyebrow">
            <span aria-hidden className="mr-1.5 inline-block h-1 w-1 rounded-full bg-primary align-middle" />
            Ready when you are
          </span>
          <h2 className="mx-auto mt-3 max-w-[640px] text-h1 font-semibold tracking-tight text-foreground sm:text-hero">
            Apply to your next role{" "}
            <span className="bg-gradient-to-r from-primary via-[hsl(var(--accent-violet))] to-[hsl(var(--accent-cyan))] bg-clip-text text-transparent">
              from one place
            </span>
            .
          </h2>
          <p className="mx-auto mt-5 max-w-[52ch] text-body text-secondary-foreground">
            Free to start. Sign in with Google in seconds. No credit card.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#how">See how it works</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================================================================
// Footer
// ===================================================================
function Footer() {
  return (
    <footer className="relative z-10 mx-auto max-w-[1200px] px-6 pb-10 sm:px-8">
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-small text-muted-foreground">
        <div className="flex items-center gap-2">
          <Image
            src="/logo-icon.png"
            alt=""
            width={589}
            height={223}
            className="h-5 w-auto"
          />
          <span>SoloOS · Career &amp; Freelance OS</span>
        </div>
        <div className="flex items-center gap-5">
          <Link
            href="/login"
            className="inline-flex items-center gap-0.5 transition-colors duration-fast hover:text-foreground"
          >
            Log in <ChevronRight className="h-3 w-3" />
          </Link>
          <span className="hidden sm:inline">·</span>
          <a
            href="mailto:support@soloos.app"
            className="transition-colors duration-fast hover:text-foreground"
          >
            Contact
          </a>
          <span className="hidden font-mono text-[11px] uppercase tracking-wider sm:inline">
            Next · Supabase · Gemini
          </span>
        </div>
      </div>
    </footer>
  );
}
