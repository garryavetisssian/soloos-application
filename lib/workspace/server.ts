import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { Application, CvDocument, decodeApplication, decodeCv, encodeJobNotes } from "./model";

type Kind = "cvs" | "jobs";
const table = { cvs: "resumes", jobs: "jobs" } as const;
const noStore = { "cache-control": "private, no-store" };
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: noStore }); }
export async function workspaceRequest(kind: Kind, request: Request, id?: string) {
  try {
    const origin = request.headers.get("origin");
    if (request.method !== "GET" && origin && origin !== new URL(request.url).origin) return reply({ error: "invalid_origin" }, 403);
    const db = await createClient();
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) return reply({ error: "unauthorized" }, 401);
    if (id && !z.string().uuid().safeParse(id).success) return reply({ error: "invalid_id" }, 400);
    const decode = (row: never) => kind === "cvs" ? decodeCv(row) : decodeApplication(row);
    if (request.method === "GET") {
      let query = db.from(table[kind]).select("*").eq("user_id", user.id);
      if (id) {
        const { data, error } = await query.eq("id", id).maybeSingle();
        if (error) return reply({ error: "load_failed" }, 500);
        return data ? reply(decode(data as never)) : reply({ error: "not_found" }, 404);
      }
      const { data, error } = await query.order("created_at", { ascending: false }).limit(500);
      if (error) return reply({ error: "load_failed" }, 500);
      return reply((data || []).map(row => decode(row as never)));
    }
    if (request.method === "DELETE" && id) {
      const { data, error } = await db.from(table[kind]).delete().eq("user_id", user.id).eq("id", id).select("id").maybeSingle();
      if (error) return reply({ error: "delete_failed" }, 500);
      return data ? reply({ ok: true }) : reply({ error: "not_found" }, 404);
    }
    if (request.method !== "POST" && request.method !== "PUT") return reply({ error: "method_not_allowed" }, 405);
    const body = await request.text();
    if (Buffer.byteLength(body) > 100000) return reply({ error: "too_large" }, 413);
    let json: unknown;
    try { json = JSON.parse(body); } catch { return reply({ error: "invalid_body" }, 400); }
    let values: Record<string, unknown>;
    if (kind === "cvs") {
      const parsed = CvDocument.safeParse(json);
      if (!parsed.success) return reply({ error: "invalid_body", fields: parsed.error.flatten().fieldErrors }, 400);
      values = { title: parsed.data.title, language: parsed.data.language, summary: JSON.stringify(parsed.data) };
    } else {
      const parsed = Application.safeParse(json);
      if (!parsed.success) return reply({ error: "invalid_body", fields: parsed.error.flatten().fieldErrors }, 400);
      if (parsed.data.letter_id) {
        const { data, error } = await db.from("saved_cover_letters").select("id").eq("user_id", user.id).eq("id", parsed.data.letter_id).maybeSingle();
        if (error) return reply({ error: "load_failed" }, 500);
        if (!data) return reply({ error: "invalid_letter" }, 400);
      }
      values = { company: parsed.data.company, position: parsed.data.position, link: parsed.data.link || null, status: parsed.data.status, notes: encodeJobNotes(parsed.data) };
    }
    const query = id ? db.from(table[kind]).update(values).eq("user_id", user.id).eq("id", id) : db.from(table[kind]).insert({ ...values, user_id: user.id });
    const { data, error } = await query.select("*").maybeSingle();
    if (error) return reply({ error: "save_failed" }, 500);
    return data ? reply(decode(data as never), id ? 200 : 201) : reply({ error: "not_found" }, 404);
  } catch { return reply({ error: "request_failed" }, 500); }
}
