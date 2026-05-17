import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /auth/signout — clears the Supabase session cookie and bounces
// the user back to the landing page with ?signedout=1 so the landing
// can render a brief "signed out" confirmation. Called from the
// account dropdown via a plain <form action="/auth/signout" method="post">,
// which works without JS and benefits from SameSite=Lax CSRF protection
// on the session cookie.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.auth.signOut();
  }
  const { origin } = new URL(request.url);
  // 303 forces the browser to GET the destination (instead of re-POSTing).
  return NextResponse.redirect(`${origin}/?signedout=1`, { status: 303 });
}
