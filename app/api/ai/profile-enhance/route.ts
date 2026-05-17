import { NextResponse } from "next/server";
import { z } from "zod";
import { extractCv } from "@/lib/cv-extract";
import {
  classifyCvLinks,
  mergeDetectedLinks,
  type DetectedLink,
} from "@/lib/cv-link-classify";
import { GEMINI_MODEL, getGemini, hasGeminiKey } from "@/lib/gemini/client";
import { PROMPTS } from "@/lib/gemini/prompts";
import {
  consumeRateLimit,
  RATE_LIMITS,
  rateLimitedResponseBody,
} from "@/lib/rate-limit";
import { SELECTABLE_LANGUAGE_LEVELS } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;

const Output = z.object({
  full_name: z.string().default(""),
  current_role: z.string().default(""),
  location: z.string().default(""),
  email: z.string().default(""),
  linkedin_url: z.string().default(""),
  portfolio_url: z.string().default(""),
  years_of_experience: z.string().default(""),
  professional_summary: z.string().default(""),
  skills: z.string().default(""),
  tools: z.string().default(""),
  languages: z
    .array(
      z.object({
        name: z.string(),
        level: z.enum([
          "Native",
          "Fluent",
          "Advanced",
          "Intermediate",
          "Basic",
        ]),
      }),
    )
    .default([]),
  target_role: z.string().default(""),
  target_industries: z.string().default(""),
  // Permissive — model occasionally invents types or omits confidence.
  // We re-classify URLs ourselves via classifyOne, so this is just transport.
  detected_links: z
    .array(
      z.object({
        url: z.string(),
        type: z.string().optional(),
        confidence: z.number().optional(),
      }),
    )
    .default([]),
});

// Per spec, all extraction failures collapse to a single human message.
// Technical reason is logged server-side only.
const EXTRACT_FAILED_MESSAGE = "We couldn't extract information from this CV.";
const EXTRACT_FAILED_SUBTEXT =
  "Try another file, or skip ahead and fill the profile manually.";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = consumeRateLimit(user.id, "generate", RATE_LIMITS.generate);
  if (!rl.ok) {
    return NextResponse.json(rateLimitedResponseBody(rl), {
      status: 429,
      headers: { "retry-after": String(rl.resetSeconds) },
    });
  }

  if (!hasGeminiKey()) {
    console.error("[profile-enhance] GOOGLE_GEMINI_API_KEY is not set");
    return NextResponse.json(
      { error: "server_misconfigured", message: "AI is not configured." },
      { status: 500 },
    );
  }

  // ---------- 1. Receive PDF ----------
  let file: File | null = null;
  try {
    const formData = await request.formData();
    const f = formData.get("file");
    if (f instanceof File) file = f;
  } catch (err) {
    console.error("[profile-enhance] formData parse failed", err);
    return NextResponse.json(
      {
        error: "invalid_body",
        message: "Send the PDF as multipart/form-data.",
      },
      { status: 400 },
    );
  }

  if (!file) {
    return NextResponse.json(
      { error: "missing_file", message: "Upload a PDF file to extract." },
      { status: 400 },
    );
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "unsupported_type", message: "Only PDF files are supported." },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", message: "File too large. Max 10 MB." },
      { status: 413 },
    );
  }

  // ---------- 2. Extract: text first, raw PDF for Gemini vision otherwise ----------
  const buffer = Buffer.from(await file.arrayBuffer());
  let lastPhase: "text" | "vision_pdf" = "text";
  const extraction = await extractCv(buffer, (phase) => {
    lastPhase = phase;
  });
  if (!extraction.ok) {
    console.error("[profile-enhance] extraction failed", {
      fileName: file.name,
      fileSize: file.size,
      reason: extraction.reason,
      detail: extraction.detail,
    });
    return NextResponse.json(
      {
        error: extraction.reason,
        message: EXTRACT_FAILED_MESSAGE,
        subtext: EXTRACT_FAILED_SUBTEXT,
        phase: lastPhase,
      },
      { status: 422 },
    );
  }

  // ---------- 3. Send to Gemini (text or vision multimodal) ----------
  let raw: string;
  try {
    const model = getGemini().getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });
    if (extraction.mode === "text") {
      const result = await model.generateContent(
        PROMPTS.cvExtract(extraction.text),
      );
      raw = result.response.text();
    } else {
      // Vision path: hand the original PDF to Gemini directly via inlineData.
      // Gemini multimodal natively reads PDF — no canvas rendering needed.
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: "application/pdf",
            data: extraction.data.toString("base64"),
          },
        },
        { text: PROMPTS.cvExtractVision() },
      ]);
      raw = result.response.text();
    }
  } catch (err) {
    const e = err as {
      message?: string;
      status?: number;
      statusText?: string;
      errorDetails?: unknown;
    };
    console.error("[profile-enhance] Gemini error", {
      model: GEMINI_MODEL,
      mode: extraction.mode,
      status: e.status,
      statusText: e.statusText,
      errorDetails: e.errorDetails,
      message: e.message,
    });
    return NextResponse.json(
      {
        error: "ai_failed",
        message: EXTRACT_FAILED_MESSAGE,
        subtext: EXTRACT_FAILED_SUBTEXT,
        upstreamStatus: e.status ?? null,
      },
      { status: 502 },
    );
  }

  // ---------- 4. Validate Gemini response ----------
  let output;
  try {
    const obj = JSON.parse(raw);
    output = Output.parse(obj);
  } catch (err) {
    console.error("[profile-enhance] JSON parse failed", { raw, err });
    return NextResponse.json(
      {
        error: "invalid_ai_response",
        message: EXTRACT_FAILED_MESSAGE,
        subtext: EXTRACT_FAILED_SUBTEXT,
      },
      { status: 502 },
    );
  }

  output.languages = output.languages
    .map((l) => ({ name: l.name.trim(), level: l.level }))
    .filter(
      (l) =>
        l.name.length > 0 &&
        (SELECTABLE_LANGUAGE_LEVELS as string[]).includes(l.level),
    );

  // ---- 5. CV link extraction & merge ----
  // In text mode we can run a deterministic regex classifier on the cleaned
  // text. Vision mode has no text on the server, so we rely on the model's
  // detected_links and just normalize/re-classify them.
  let regexLinks: DetectedLink[] = [];
  let regexLinkedin = "";
  let regexPortfolio = "";
  if (extraction.mode === "text") {
    const cls = classifyCvLinks(extraction.text);
    regexLinks = cls.detected_links;
    regexLinkedin = cls.linkedin_url;
    regexPortfolio = cls.portfolio_url;
  }

  // Merge: regex deterministic wins; otherwise fall back to the model's
  // best guess. Only fill linkedin_url / portfolio_url here if they're not
  // already set by the model with something the user might trust.
  const mergedLinkedin = regexLinkedin || output.linkedin_url || "";
  const mergedPortfolio = regexPortfolio || output.portfolio_url || "";
  const mergedDetected = mergeDetectedLinks(regexLinks, output.detected_links);

  return NextResponse.json({
    ...output,
    linkedin_url: mergedLinkedin,
    portfolio_url: mergedPortfolio,
    detected_links: mergedDetected,
    mode: extraction.mode,
  });
}
