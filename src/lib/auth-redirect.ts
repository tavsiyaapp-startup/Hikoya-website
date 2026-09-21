import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Self-hosted behind nginx: the reverse proxy doesn't forward the original
// Host header, so building redirects off `request.url` resolves to the app's
// internal localhost address instead of the public site — use the known
// public URL as the base instead.
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://hikoya.org";

// After any successful sign-in, send first-time users into onboarding and
// everyone else to wherever they were headed.
export async function redirectAfterAuth(next: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", user.id)
      .single();

    if (!profile?.onboarded_at) {
      const onboardingUrl = new URL("/onboarding", siteOrigin);
      onboardingUrl.searchParams.set("next", next);
      return NextResponse.redirect(onboardingUrl);
    }
  }

  return NextResponse.redirect(new URL(next, siteOrigin));
}
