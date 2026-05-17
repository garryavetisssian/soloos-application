import { NextResponse, type NextRequest } from "next/server";
import {
  COVER_LETTER_MIN_COMPLETENESS,
  computeCompleteness,
  formStateFromRow,
} from "@/lib/profile-form";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // Decide the post-login destination based on profile state. This avoids an
  // extra redirect hop through /dashboard → /(app) layout → /onboarding for
  // users who haven't completed onboarding yet.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
    const completeness = computeCompleteness(
      formStateFromRow(profile as UserProfile),
    );
    if (completeness < COVER_LETTER_MIN_COMPLETENESS) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  // Open-redirect guard: `next` must be a same-origin path. Reject
  // anything that doesn't start with "/" or that begins with "//"
  // (protocol-relative) or "/\" (Windows-style). Without this,
  // ?next=@evil.com yields "https://soloos.app@evil.com" — a valid
  // URL whose host is evil.com, perfect for phishing.
  const safeNext =
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
      ? next
      : "/dashboard";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
