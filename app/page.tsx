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

// SoloOS landing — Clean Slate marketing surface.
// Sections (top → bottom):
//   1. Hero with CTA + a "cover letter being composed" mockup
//   2. Persona strip — who SoloOS is built for
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
    <main className="relative min-h-screen overflow-hidden bg-bg-subtle">
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
        "fixed left-1/2 top-4 z-50 -translate-x-1/2",
        "flex items-center gap-2.5 rounded-full px-4 py-2",
        "border border-border bg-surface text-small text-foreground shadow-md",
      )}
    >
      <span
        aria-hidden
        className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-success"
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
          className="h-7 w-auto transition-transform duration-150 ease-out group-hover:scale-[1.04]"
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
        <span className="mx-2 hidden h-4 w-px bg-border sm:block" />
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
              "border border-border bg-accent-soft",
              "text-label font-medium text-primary",
            )}
          >
            <Sparkles className="h-3 w-3" />
            Career &amp; Freelance OS
          </span>
          <h1 className="mt-6 text-masthead font-semibold tracking-tight text-foreground">
            One workspace for your{" "}
            <span className="text-primary">entire job search</span>.
          </h1>
          <p className="mt-6 max-w-[58ch] text-body leading-relaxed text-muted-foreground">
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

// Stylized "cover letter being composed" mockup. Three stacked cards:
// the top one carries a job-pipeline mini, the center one shows a
// rendered letter snippet + AI tone chips, the bottom one shows the
// saved-to-library confirmation. Built with divs + Tailwind only.
function HeroMockup() {
  return (
    <div className="relative mx-auto h-[460px] w-full max-w-[520px]">
      {/* Saved-letter pill — bottom-right, slight rotate. */}
      <div className="absolute bottom-2 right-4 w-[230px] rotate-[3deg] rounded-xl border border-border bg-surface p-3 shadow-md">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-success/15 text-success">
            <Check className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-small font-medium text-foreground">
              Saved to library
            </div>
            <div className="truncate text-label text-muted-foreground">
              Acme · Senior Product Designer
            </div>
          </div>
        </div>
      </div>

      {/* Compose card — center, the focal mock. */}
      <div className="absolute left-1/2 top-1/2 w-[420px] -translate-x-1/2 -translate-y-1/2 -rotate-[2deg] rounded-xl border border-border bg-surface p-5 shadow-md">
        <div className="flex items-center justify-between gap-3 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-primary">
              <Mail className="h-3.5 w-3.5" />
            </span>
            <span className="text-small font-medium text-foreground">
              Cover letter
            </span>
          </div>
          <span className="text-label font-medium uppercase tracking-wider text-muted-foreground">
            EN · AI
          </span>
        </div>
        <div className="space-y-2 rounded-md bg-surface-elevated p-3">
          <div className="h-2 w-[88%] rounded-full bg-muted-foreground/25" />
          <div className="h-2 w-[72%] rounded-full bg-muted-foreground/15" />
          <div className="h-2 w-[94%] rounded-full bg-muted-foreground/25" />
          <div className="h-2 w-[64%] rounded-full bg-muted-foreground/15" />
          <div className="h-2 w-[80%] rounded-full bg-muted-foreground/25" />
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <ToolChip>Make stronger</ToolChip>
          <ToolChip>Shorten</ToolChip>
          <ToolChip>Translate</ToolChip>
        </div>
      </div>

      {/* Job pipeline mini — top-left, slight rotate. */}
      <div className="absolute left-4 top-4 w-[260px] -rotate-[4deg] rounded-xl border border-border bg-surface p-3 shadow-md">
        <div className="flex items-center gap-2 pb-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-primary">
            <Briefcase className="h-3 w-3" />
          </span>
          <span className="text-small font-medium text-foreground">
            Pipeline
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          <PipelineMini label="Saved" n={4} />
          <PipelineMini label="Applied" n={2} />
          <PipelineMini label="Interview" n={1} accent />
          <PipelineMini label="Offer" n={0} />
        </div>
      </div>
    </div>
  );
}

function ToolChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-label text-muted-foreground">
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
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-elevated p-1.5 text-center">
      <div
        className={cn(
          "text-body font-semibold tabular-nums",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {n}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

// ===================================================================
// Persona strip
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
    <section className="scroll-reveal relative z-10 border-y border-border bg-surface py-7">
      <p className="eyebrow mx-auto max-w-[1200px] px-6 pb-3 sm:px-8">
        Built for
      </p>
      <div className="marquee-mask overflow-hidden">
        <div className="marquee-track">
          {loop.map((p, i) => (
            <span
              key={`${p}-${i}`}
              className="flex items-center gap-3 px-6 text-h3 font-medium text-muted-foreground"
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
        <span className="eyebrow">How it works</span>
        <h2 className="mt-3 text-h1 font-semibold tracking-tight text-foreground">
          From one job posting to a sent application{" "}
          <span className="text-muted-foreground">in minutes.</span>
        </h2>
      </div>

      <ol className="mt-12 grid gap-4 md:grid-cols-3">
        <Step
          num="1"
          icon={<Sparkles className="h-5 w-5" />}
          title="Tell us about you, once."
          body="A guided profile captures your skills, target roles, tools, and portfolio links. Or upload a CV — we'll extract it."
        />
        <Step
          num="2"
          icon={<Search className="h-5 w-5" />}
          title="Paste any job link."
          body="SoloOS reads the page — company, role, requirements — and writes a letter that weaves in your portfolio."
        />
        <Step
          num="3"
          icon={<Briefcase className="h-5 w-5" />}
          title="Track and follow up."
          body="Save the letter, log the application, and move it through Applied → Interview → Offer as it progresses."
        />
      </ol>
    </section>
  );
}

function Step({
  num,
  icon,
  title,
  body,
}: {
  num: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="lift-on-hover relative rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-primary">
          {icon}
        </span>
        <span className="text-small font-semibold tabular-nums text-muted-foreground">
          {num}
        </span>
      </div>
      <h3 className="mt-5 text-h3 font-semibold tracking-tight text-foreground">
        {title}
      </h3>
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
          <span className="eyebrow">AI cover letters</span>
          <h2 className="mt-3 text-h1 font-semibold tracking-tight text-foreground">
            Tailored letters{" "}
            <span className="text-muted-foreground">
              that actually mention the company.
            </span>
          </h2>
          <p className="mt-5 text-body leading-relaxed text-muted-foreground">
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
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-6 shadow-md">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-primary">
              <Mail className="h-4 w-4" />
            </span>
            <div>
              <div className="text-small font-medium text-foreground">
                Senior Product Designer
              </div>
              <div className="text-label text-muted-foreground">
                Stripe · stripe.com/jobs/...
              </div>
            </div>
          </div>
          <span className="text-label font-medium uppercase tracking-wider text-muted-foreground">
            Generated 2s ago
          </span>
        </div>
        <div className="space-y-2 py-5">
          {LINES.map((w, i) => (
            <div
              key={i}
              className="h-2 rounded-full bg-surface-elevated"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-4">
          <ToneTag tone="Confident" active />
          <ToneTag tone="Friendly" />
          <ToneTag tone="Formal" />
          <ToneTag tone="Startup" />
          <div className="ml-auto flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-label text-muted-foreground">
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
        "inline-flex items-center rounded-full px-2 py-0.5 text-label font-medium",
        active
          ? "bg-accent-soft text-primary"
          : "border border-border bg-surface-elevated text-muted-foreground",
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
        className="mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-primary"
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
          <span className="eyebrow">Job tracker</span>
          <h2 className="mt-3 text-h1 font-semibold tracking-tight text-foreground">
            One pipeline,{" "}
            <span className="text-muted-foreground">every platform.</span>
          </h2>
          <p className="mt-5 text-body leading-relaxed text-muted-foreground">
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
    accent: boolean;
    cards: { company: string; role: string }[];
  }> = [
    {
      title: "Saved",
      accent: false,
      cards: [
        { company: "Linear", role: "Senior Designer" },
        { company: "Arc", role: "Web Engineer" },
      ],
    },
    {
      title: "Applied",
      accent: false,
      cards: [
        { company: "Stripe", role: "Product Designer" },
        { company: "Vercel", role: "Design Engineer" },
      ],
    },
    {
      title: "Interview",
      accent: true,
      cards: [{ company: "Notion", role: "Senior Designer" }],
    },
    {
      title: "Offer",
      accent: false,
      cards: [],
    },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[620px]">
      <div className="overflow-hidden rounded-xl border border-border bg-surface p-4 shadow-md">
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
  accent: boolean;
  cards: { company: string; role: string }[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-elevated p-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              accent ? "bg-primary" : "bg-muted-foreground/40",
            )}
          />
          <span
            className={cn(
              "text-label font-medium",
              accent ? "text-primary" : "text-muted-foreground",
            )}
          >
            {title}
          </span>
        </div>
        <span className="text-label tabular-nums text-muted-foreground">
          {cards.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {cards.map((c, i) => (
          <div key={i} className="rounded-md border border-border bg-surface p-2">
            <div className="truncate text-label font-medium text-foreground">
              {c.company}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">
              {c.role}
            </div>
          </div>
        ))}
        {cards.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-2 text-center text-[10px] text-muted-foreground">
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
          <span className="eyebrow">Portfolio links</span>
          <h2 className="mt-3 text-h1 font-semibold tracking-tight text-foreground">
            Drop a URL.{" "}
            <span className="text-muted-foreground">We do the writing.</span>
          </h2>
          <p className="mt-5 text-body leading-relaxed text-muted-foreground">
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
  }> = [
    {
      icon: <Briefcase className="h-3.5 w-3.5" />,
      title: "Personal portfolio",
      domain: "garry.design",
      tag: "Portfolio",
    },
    {
      icon: <Link2 className="h-3.5 w-3.5" />,
      title: "Design system case study",
      domain: "figma.com/file/...",
      tag: "Figma",
    },
    {
      icon: <Link2 className="h-3.5 w-3.5" />,
      title: "ruv-fann · neural agents",
      domain: "github.com/...",
      tag: "GitHub",
    },
    {
      icon: <Link2 className="h-3.5 w-3.5" />,
      title: "Notes from shipping SoloOS",
      domain: "garryslist.org/...",
      tag: "Article",
    },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div className="space-y-2 rounded-xl border border-border bg-surface p-4 shadow-md">
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
}: {
  icon: React.ReactNode;
  title: string;
  domain: string;
  tag: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-surface-elevated p-3 transition-colors duration-150 hover:border-muted-foreground/30">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-small font-medium text-foreground">
          {title}
        </div>
        <div className="truncate text-label text-muted-foreground">
          {domain}
        </div>
      </div>
      <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
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
    <section className="scroll-reveal relative z-10 border-y border-border bg-surface py-12">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 px-6 sm:px-8 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center md:text-left">
            <div className="text-hero font-semibold tabular-nums tracking-tight text-foreground">
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
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface px-8 py-14 text-center shadow-sm sm:px-12 sm:py-20">
        <div className="relative">
          <span className="eyebrow">Ready when you are</span>
          <h2 className="mx-auto mt-3 max-w-[640px] text-hero font-semibold tracking-tight text-foreground">
            Apply to your next role{" "}
            <span className="text-primary">from one place</span>.
          </h2>
          <p className="mx-auto mt-5 max-w-[52ch] text-body text-muted-foreground">
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
      <div className="h-px bg-border" />
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
            className="inline-flex items-center gap-0.5 transition-colors duration-150 hover:text-foreground"
          >
            Log in <ChevronRight className="h-3 w-3" />
          </Link>
          <span className="hidden sm:inline">·</span>
          <a
            href="mailto:support@soloos.app"
            className="transition-colors duration-150 hover:text-foreground"
          >
            Contact
          </a>
          <span className="hidden text-label uppercase tracking-wider sm:inline">
            Next · Supabase · Gemini
          </span>
        </div>
      </div>
    </footer>
  );
}
