import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { getCurrentProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  content: z.string().min(1).max(20000),
  job_title: z.string().max(200).optional(),
  company_name: z.string().max(200).optional(),
});

// =============================================================
// Font loading
// =============================================================
// PDFKit's built-in fonts (Helvetica etc.) are AFM/Type 1 and only
// support WinAnsi (Latin-1). They produce mojibake — "ÀÅ5CÔO" — for
// Cyrillic and Armenian. We embed Noto Sans (Latin + Cyrillic) and
// Noto Sans Armenian as TrueType so the PDF carries actual Unicode
// glyph data.
//
// The TTFs are read once at module load and reused per request — the
// Buffers are immutable and PDFKit accepts them directly.
// Files live next to the route under `lib/export/fonts/` so they ship
// with the server bundle (not exposed as static URLs under public/).

const FONT_DIR = path.join(process.cwd(), "lib/export/fonts");

const FONT_BUFFERS = {
  latinRegular: fs.readFileSync(path.join(FONT_DIR, "NotoSans-Regular.ttf")),
  latinBold: fs.readFileSync(path.join(FONT_DIR, "NotoSans-Bold.ttf")),
  armenianRegular: fs.readFileSync(
    path.join(FONT_DIR, "NotoSansArmenian-Regular.ttf"),
  ),
  armenianBold: fs.readFileSync(
    path.join(FONT_DIR, "NotoSansArmenian-Bold.ttf"),
  ),
};

const FONT_LATIN_REGULAR = "NotoSans-Regular";
const FONT_LATIN_BOLD = "NotoSans-Bold";
const FONT_ARMENIAN_REGULAR = "NotoSansArmenian-Regular";
const FONT_ARMENIAN_BOLD = "NotoSansArmenian-Bold";

// =============================================================
// Script-aware tokenization
// =============================================================
// Noto Sans covers Latin, Cyrillic, Greek, Latin Extended, common
// punctuation. It does NOT cover the Armenian block (U+0530–U+058F,
// U+FB13–U+FB17). For each text run we split into segments where
// consecutive characters share a font family, then render them with
// `continued: true` so PDFKit lays them out as a single visual line.

const ARMENIAN_RE = /[԰-֏ﬓ-ﬗ]/;

function isArmenianChar(ch: string): boolean {
  return ARMENIAN_RE.test(ch);
}

interface Run {
  text: string;
  bold?: boolean;
  link?: string;
}

interface FontRun extends Run {
  font: string;
}

// Split a Run into sub-runs grouped by which font family supports the
// characters. Whitespace and punctuation default to the Latin font so
// long runs of Armenian followed by an English company name don't keep
// re-switching — mixed Latin + Armenian sentences flow naturally.
function splitByScript(run: Run): FontRun[] {
  if (!run.text) return [];
  const out: FontRun[] = [];
  let buf = "";
  let bufIsArmenian: boolean | null = null;
  // Use Array.from so multi-byte codepoints (esp. surrogate pairs) stay intact.
  const chars = Array.from(run.text);
  for (const ch of chars) {
    const isArm = isArmenianChar(ch);
    // Whitespace inherits the surrounding script — it has no glyphs of
    // its own and switching mid-word causes spurious gaps in PDFKit.
    const treatAs: boolean =
      ch.trim().length === 0 && bufIsArmenian !== null ? bufIsArmenian : isArm;
    if (bufIsArmenian === null) {
      bufIsArmenian = treatAs;
      buf += ch;
      continue;
    }
    if (treatAs !== bufIsArmenian) {
      out.push({ ...run, text: buf, font: fontFor(bufIsArmenian, run.bold) });
      buf = ch;
      bufIsArmenian = treatAs;
    } else {
      buf += ch;
    }
  }
  if (buf) {
    out.push({
      ...run,
      text: buf,
      font: fontFor(bufIsArmenian ?? false, run.bold),
    });
  }
  return out;
}

function fontFor(isArmenian: boolean, bold?: boolean): string {
  if (isArmenian) {
    return bold ? FONT_ARMENIAN_BOLD : FONT_ARMENIAN_REGULAR;
  }
  return bold ? FONT_LATIN_BOLD : FONT_LATIN_REGULAR;
}

// =============================================================
// URL / email tokenization
// =============================================================
// We render URLs and emails as clickable links underlined in the
// primary brand colour. A naive regex is fine for cover-letter content
// — we accept that "see more at example.com." may include the trailing
// dot in some edge cases; users rarely write bare URLs without
// surrounding whitespace.
const URL_RE =
  /\b(?:https?:\/\/[^\s)]+[^\s).,!?:;]|www\.[^\s)]+[^\s).,!?:;]|[\w.-]+@[\w.-]+\.[A-Za-z]{2,})/g;

function tokenizeLinks(text: string): Run[] {
  const out: Run[] = [];
  let lastIdx = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    if (start > lastIdx) out.push({ text: text.slice(lastIdx, start) });
    const raw = m[0];
    const href = raw.startsWith("http")
      ? raw
      : raw.includes("@")
        ? `mailto:${raw}`
        : `https://${raw}`;
    out.push({ text: raw, link: href });
    lastIdx = start + raw.length;
  }
  if (lastIdx < text.length) out.push({ text: text.slice(lastIdx) });
  return out;
}

// Run a top-level paragraph through both tokenizers: first split on
// links, then split each piece by script. Returns a flat list of font
// runs ready to feed into pdfkit.text(continued: true) calls.
function buildParagraphRuns(text: string, bold?: boolean): FontRun[] {
  const linkRuns = tokenizeLinks(text);
  const out: FontRun[] = [];
  for (const lr of linkRuns) {
    for (const sub of splitByScript({ ...lr, bold })) {
      out.push(sub);
    }
  }
  return out;
}

// =============================================================
// Layout
// =============================================================
const MARGIN = 50;
const NAME_SIZE = 19;
const CONTACT_SIZE = 10.5;
const BODY_SIZE = 11.5;
// PDFKit uses lineGap as the *extra* spacing between lines (on top of
// the font's natural ascent/descent). For ~1.5 line-height on 11.5pt:
// 1.5 * 11.5 = 17.25, font's natural line ≈ 13.8 → gap ≈ 3.5pt.
const BODY_LINE_GAP = 3.5;
const PARAGRAPH_GAP = 6;
const LINK_COLOR = "#1a73e8";
const BODY_COLOR = "#111111";
const MUTED_COLOR = "#555555";
const DIVIDER_COLOR = "#dddddd";

interface BuildOpts {
  content: string;
  fullName: string;
  email: string;
  linkedinUrl: string;
  portfolioUrl: string;
}

function buildPdf(opts: BuildOpts): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Register all four faces so we can switch via doc.font(name).
    doc.registerFont(FONT_LATIN_REGULAR, FONT_BUFFERS.latinRegular);
    doc.registerFont(FONT_LATIN_BOLD, FONT_BUFFERS.latinBold);
    doc.registerFont(FONT_ARMENIAN_REGULAR, FONT_BUFFERS.armenianRegular);
    doc.registerFont(FONT_ARMENIAN_BOLD, FONT_BUFFERS.armenianBold);

    // Default font for any code path that forgets to set one explicitly.
    doc.font(FONT_LATIN_REGULAR);

    // ---------- Header: name ----------
    if (opts.fullName) {
      renderRuns(doc, buildParagraphRuns(opts.fullName, true), {
        size: NAME_SIZE,
        color: BODY_COLOR,
      });
      doc.moveDown(0.3);
    }

    // ---------- Header: contact line (email · linkedin · portfolio) ----------
    const contactSegments = [opts.email, opts.linkedinUrl, opts.portfolioUrl]
      .map((s) => s?.trim())
      .filter((s): s is string => Boolean(s));
    if (contactSegments.length > 0) {
      const contactLine = contactSegments.join("  ·  ");
      renderRuns(doc, buildParagraphRuns(contactLine), {
        size: CONTACT_SIZE,
        color: MUTED_COLOR,
      });
      doc.moveDown(0.6);
    }

    // ---------- Divider ----------
    if (opts.fullName || contactSegments.length > 0) {
      const right = doc.page.width - MARGIN;
      doc
        .strokeColor(DIVIDER_COLOR)
        .lineWidth(0.5)
        .moveTo(MARGIN, doc.y)
        .lineTo(right, doc.y)
        .stroke();
      doc.moveDown(0.8);
    }

    // ---------- Body ----------
    // Split on blank lines so each paragraph is its own continued run
    // group. PDFKit handles wrapping + pagination inside a single
    // text() chain automatically.
    const paragraphs = opts.content
      .replace(/\r\n/g, "\n")
      .split(/\n{2,}/)
      .map((p) => p.replace(/\n/g, " ").trim())
      .filter(Boolean);

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const runs = buildParagraphRuns(paragraphs[pIdx]);
      renderRuns(doc, runs, {
        size: BODY_SIZE,
        color: BODY_COLOR,
        lineGap: BODY_LINE_GAP,
      });
      if (pIdx < paragraphs.length - 1) {
        doc.moveDown(PARAGRAPH_GAP / 12);
      }
    }

    doc.end();
  });
}

interface RenderOpts {
  size: number;
  color: string;
  lineGap?: number;
}

// Render a sequence of font runs as one logical paragraph. We use
// `continued: true` for every run but the last so PDFKit treats them as
// the same text flow — wrapping, spacing, and pagination all behave as
// if it were a single string.
function renderRuns(
  doc: PDFKit.PDFDocument,
  runs: FontRun[],
  opts: RenderOpts,
): void {
  if (runs.length === 0) return;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const isLast = i === runs.length - 1;
    doc.font(run.font).fontSize(opts.size);
    // Set fill colour explicitly on every run — PDFKit otherwise sticks
    // to whatever the previous run picked, which would leave URLs blue
    // for the rest of the paragraph after a mailto link.
    doc.fillColor(run.link ? LINK_COLOR : opts.color);
    doc.text(run.text, {
      continued: !isLast,
      link: run.link ?? null,
      underline: run.link ? true : false,
      lineGap: opts.lineGap ?? 0,
    });
  }
}

// =============================================================
// Filename helper
// =============================================================
function slugify(s: string): string {
  return (
    s
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "user"
  );
}

// =============================================================
// Route
// =============================================================
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", message: "Provide letter content." },
      { status: 400 },
    );
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { error: "profile_required", message: "Profile not found." },
      { status: 412 },
    );
  }

  let pdf: Buffer;
  try {
    pdf = await buildPdf({
      content: parsed.data.content,
      fullName: profile.full_name ?? "",
      email: profile.email ?? "",
      linkedinUrl: profile.linkedin_url ?? "",
      portfolioUrl: profile.portfolio_url ?? "",
    });
  } catch (err) {
    console.error("[cover-letter-pdf] build failed", err);
    return NextResponse.json(
      {
        error: "pdf_failed",
        message: "Couldn't generate the PDF. Try again.",
      },
      { status: 502 },
    );
  }

  const stem = slugify(profile.full_name ?? user.email ?? "user");
  const filename = `cover-letter-${stem}.pdf`;

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
