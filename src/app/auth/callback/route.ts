import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirectAfterAuth } from "@/lib/auth-redirect";

// PKCE code exchange for Google OAuth and Email magic-link sign-in.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectAfterAuth(request, next);
    }
  }

  return NextResponse.redirect(new URL("/onboarding?error=auth", request.url));
}
