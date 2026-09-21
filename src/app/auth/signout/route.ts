import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  // signOut()'s default scope is 'global' — every device the user is signed
  // in on, not just this one. A "Sign out" button is expected to leave
  // other devices/browsers signed in.
  await supabase.auth.signOut({ scope: "local" });
  // Self-hosted behind nginx: the reverse proxy doesn't forward the original
  // Host header, so `request.url` resolves to the app's internal localhost
  // address instead of the public site — use the known public URL instead.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hikoya.org";
  return NextResponse.redirect(new URL("/", siteUrl));
}
