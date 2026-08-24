import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { redirectAfterAuth } from "@/lib/auth-redirect";

// Verifies the token_hash from a Supabase magic-link — used both for plain
// email sign-in and as the second half of the Telegram bridge in
// /auth/telegram, which generates a magiclink server-side and redirects here.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return redirectAfterAuth(request, next);
    }
  }

  return NextResponse.redirect(new URL("/onboarding?error=auth", request.url));
}
