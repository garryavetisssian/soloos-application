"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      {/* Full branded logo as the hero — icon + wordmark stacked. The
          PNG is the marketing logo with text baked in, so we render
          it directly and the H2 below acts as the sub-headline. */}
      <Image
        src="/logo.png"
        alt="SoloOS"
        width={590}
        height={332}
        priority
        className="mb-8 h-auto w-[180px]"
      />

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-h2">Sign in to SoloOS</CardTitle>
          <p className="pt-1 text-small text-muted-foreground">
            Your career workspace, one click away.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={signInWithGoogle}>
            Continue with Google
          </Button>
          <p className="text-small text-muted-foreground">
            By continuing you agree to our terms of service.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
