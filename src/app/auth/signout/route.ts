import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Self-hosted behind nginx: the reverse proxy doesn't forward the original
  // Host header, so `request.url` resolves to the app's internal localhost
  // address instead of the public site — use the known public URL instead.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hikoya.org";
  return NextResponse.redirect(new URL("/", siteUrl));
}
