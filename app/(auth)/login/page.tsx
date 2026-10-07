"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  async function signInWithGoogle() {
    if (!configured) return;
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-bg-subtle px-6 py-12">
      <Link
        href="/"
        className="absolute left-6 top-6 inline-flex items-center gap-1.5 text-small text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to home
      </Link>

      {/* Full branded logo as the hero — icon + wordmark stacked. The
          PNG is the marketing logo with text baked in, so we render
          it directly and the card title below acts as the sub-headline. */}
      <Image
        src="/logo.png"
        alt="SoloOS"
        width={590}
        height={332}
        priority
        className="mb-8 h-auto w-[180px]"
      />

      <Card className="w-full max-w-sm shadow-md">
        <CardHeader>
          <CardTitle className="text-h2 font-semibold">
            Sign in to SoloOS
          </CardTitle>
          <p className="pt-1 text-small text-muted-foreground">
            Your career workspace, one click away.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" size="lg" disabled={!configured} onClick={signInWithGoogle}>
            <GoogleIcon />
            Continue with Google
          </Button>
          {!configured && <p role="status" className="text-small text-muted-foreground">Source preview: sign-in is unavailable until the optional services are configured. The public site can be explored without an account.</p>}

          <ul className="space-y-2 text-small text-muted-foreground">
            <Perk>Build CVs and AI cover letters</Perk>
            <Perk>Track every application in one pipeline</Perk>
            <Perk>English · Русский · Հայերեն</Perk>
          </ul>

          <p className="border-t border-border pt-3 text-small text-muted-foreground">
            By continuing you agree to our terms of service.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function Perk({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
      {children}
    </li>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
