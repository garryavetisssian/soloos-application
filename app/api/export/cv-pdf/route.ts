import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CvDocument } from "@/lib/workspace/model";
import { buildCvPdf } from "@/lib/export/cv-pdf";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.text();
  if (Buffer.byteLength(body) > 100000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  let json: unknown;
  try { json = JSON.parse(body); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }
  const parsed = CvDocument.safeParse(json);
  if (!parsed.success || !parsed.data.full_name.trim()) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const pdf = await buildCvPdf(parsed.data);
    const stem = parsed.data.full_name.normalize("NFKD").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0,60) || "resume";
    return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${stem}_CV_${parsed.data.language.toUpperCase()}.pdf"`, "cache-control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "pdf_failed" }, { status: 500 }); }
}
