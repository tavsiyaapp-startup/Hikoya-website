import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// After any successful sign-in, send first-time users into onboarding and
// everyone else to wherever they were headed.
export async function redirectAfterAuth(request: Request, next: string) {
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
      const onboardingUrl = new URL("/onboarding", request.url);
      onboardingUrl.searchParams.set("next", next);
      return NextResponse.redirect(onboardingUrl);
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
