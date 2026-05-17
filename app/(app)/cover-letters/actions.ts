"use server";

import { revalidatePath } from "next/cache";
import type { JobResearch } from "@/lib/job-research/types";
import { ensurePublicUser } from "@/lib/supabase/ensure-public-user";
import { createClient } from "@/lib/supabase/server";

export type SaveCoverLetterResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type MutationResult =
  | { ok: true }
  | { ok: false; error: string };

type SourceType = "manual" | "job_link";
type Language = "English" | "Russian" | "Armenian";
type Channel = "platform" | "direct";

const ALLOWED_LANGUAGES: ReadonlyArray<Language> = [
  "English",
  "Russian",
  "Armenian",
];
const ALLOWED_SOURCE_TYPES: ReadonlyArray<SourceType> = ["manual", "job_link"];
const ALLOWED_CHANNELS: ReadonlyArray<Channel> = ["platform", "direct"];

interface SaveCoverLetterInput {
  content: string;
  job_title?: string;
  company_name?: string;
  language?: string;
  source_type?: string;
  source_url?: string;
  job_description?: string;
  job_research?: JobResearch | null;
  channel?: string;
  recipient_name?: string;
}

const trim = (v: string | undefined | null, max = 200) =>
  v && v.trim().length > 0 ? v.trim().slice(0, max) : null;

function coerceLanguage(v: string | undefined): Language | null {
  if (!v) return null;
  return (ALLOWED_LANGUAGES as readonly string[]).includes(v)
    ? (v as Language)
    : null;
}
function coerceSourceType(v: string | undefined): SourceType | null {
  if (!v) return null;
  return (ALLOWED_SOURCE_TYPES as readonly string[]).includes(v)
    ? (v as SourceType)
    : null;
}
function coerceChannel(v: string | undefined): Channel | null {
  if (!v) return null;
  return (ALLOWED_CHANNELS as readonly string[]).includes(v)
    ? (v as Channel)
    : null;
}

export async function saveCoverLetterAction(
  input: SaveCoverLetterInput,
): Promise<SaveCoverLetterResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("[saveCoverLetter] auth failed", authError);
    return { ok: false, error: "Not authenticated. Please sign in again." };
  }

  const content = input.content.trim();
  if (!content) {
    return { ok: false, error: "Letter content is empty." };
  }
  if (content.length > 20_000) {
    return { ok: false, error: "Letter is too long to save." };
  }

  // Defensive: make sure the public.users row exists so the FK on
  // saved_cover_letters.user_id resolves.
  const ensured = await ensurePublicUser(supabase, user);
  if (!ensured.ok) {
    return {
      ok: false,
      error: `Couldn't prepare your account: ${ensured.error}`,
    };
  }

  const { data, error } = await supabase
    .from("saved_cover_letters")
    .insert({
      user_id: user.id,
      content,
      job_title: trim(input.job_title),
      company_name: trim(input.company_name),
      language: coerceLanguage(input.language),
      source_type: coerceSourceType(input.source_type),
      source_url: trim(input.source_url, 2048),
      // job_description can be long — same 8k cap as the input form.
      job_description: trim(input.job_description, 8000),
      job_research: input.job_research ?? null,
      channel: coerceChannel(input.channel),
      recipient_name: trim(input.recipient_name),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[saveCoverLetter] insert failed", {
      userId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return { ok: false, error: error.message };
  }

  // Library page is a server component — revalidate so the just-saved
  // letter appears on the next visit without a hard reload.
  revalidatePath("/cover-letters");

  return { ok: true, id: data.id as string };
}

interface UpdateCoverLetterInput {
  id: string;
  content?: string;
  job_title?: string | null;
  company_name?: string | null;
  language?: string | null;
  channel?: string | null;
  recipient_name?: string | null;
}

export async function updateCoverLetterAction(
  input: UpdateCoverLetterInput,
): Promise<MutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated. Please sign in again." };
  }

  const patch: Record<string, unknown> = {};
  if (typeof input.content === "string") {
    const c = input.content.trim();
    if (!c) return { ok: false, error: "Letter content is empty." };
    if (c.length > 20_000) {
      return { ok: false, error: "Letter is too long to save." };
    }
    patch.content = c;
  }
  if (input.job_title !== undefined) patch.job_title = trim(input.job_title);
  if (input.company_name !== undefined) {
    patch.company_name = trim(input.company_name);
  }
  if (input.language !== undefined) {
    patch.language = coerceLanguage(input.language ?? undefined);
  }
  if (input.channel !== undefined) {
    patch.channel = coerceChannel(input.channel ?? undefined);
  }
  if (input.recipient_name !== undefined) {
    patch.recipient_name = trim(input.recipient_name);
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase
    .from("saved_cover_letters")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[updateCoverLetter] update failed", {
      userId: user.id,
      letterId: input.id,
      code: error.code,
      message: error.message,
    });
    return { ok: false, error: error.message };
  }

  revalidatePath("/cover-letters");
  revalidatePath(`/cover-letters/${input.id}`);
  return { ok: true };
}

export async function deleteCoverLetterAction(
  id: string,
): Promise<MutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated. Please sign in again." };
  }
  const { error } = await supabase
    .from("saved_cover_letters")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    console.error("[deleteCoverLetter] delete failed", {
      userId: user.id,
      letterId: id,
      code: error.code,
      message: error.message,
    });
    return { ok: false, error: error.message };
  }
  revalidatePath("/cover-letters");
  return { ok: true };
}
