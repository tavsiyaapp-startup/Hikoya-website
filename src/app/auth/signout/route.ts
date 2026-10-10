import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAuth } from "@/server/auth/config";

export async function POST() {
  // Better Auth's sign-out only ever clears this one session/device — there
  // isn't a separate "every device" scope the way Supabase's default was,
  // so nothing else to opt out of here.
  await getAuth().api.signOut({ headers: await headers() });
  // Self-hosted behind nginx: the reverse proxy doesn't forward the original
  // Host header, so `request.url` resolves to the app's internal localhost
  // address instead of the public site — use the known public URL instead.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hikoya.org";
  return NextResponse.redirect(new URL("/", siteUrl));
}
