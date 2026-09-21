import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "./config";

// Refreshes the Supabase auth session cookies on every request and gates
// /admin to signed-in staff. Called from proxy.ts (Next.js 16's renamed
// middleware.ts — same mechanics, request-scoped, no DB calls beyond the
// lightweight profile-role lookup needed for the admin gate).
// "/admin" and "/admin/..." are gated below, but NOT "/admin-login" — a
// plain startsWith("/admin") also matches "/admin-login" itself, which
// would bounce a signed-out visitor away from the login page before they
// could ever use it.
function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

// Self-hosted behind nginx: the reverse proxy doesn't forward the original
// Host header, so building redirects off `request.url` resolves to the
// app's internal localhost address instead of the public site — use the
// known public URL as the base instead.
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://hikoya.org";

export async function updateSession(request: NextRequest) {
  // Runs on every request — never let an unconfigured/unreachable Supabase
  // project hang the whole app behind a slow DNS/connect timeout.
  if (!isSupabaseConfigured()) {
    if (isAdminPath(request.nextUrl.pathname)) {
      return NextResponse.redirect(
        new URL(`/admin-login?next=${encodeURIComponent(request.nextUrl.pathname)}`, siteOrigin)
      );
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  // Self-hosted: sessions created before the cookie-size fix (tokens-only
  // encoding — see client.ts/server.ts) were stored as chunked cookies
  // (…-auth-token.0, .1, …) because the old format didn't fit in one
  // cookie. Those chunks alone are bigger than nginx's response header
  // buffer, so letting the SDK read and possibly rewrite them risks the
  // same "upstream sent too big header" 502. The new format always fits in
  // a single cookie, so any chunk suffix still around is unambiguously a
  // leftover from before the fix — clear it here, before the SDK sees it,
  // so the visitor is just signed out cleanly instead of hitting a dead
  // page. They log back in and get the new, smaller cookie.
  const allCookieNames = request.cookies.getAll().map((c) => c.name);
  const chunkedAuthCookies = allCookieNames.filter((name) => /-auth-token\.\d+$/.test(name));
  if (chunkedAuthCookies.length > 0) {
    const baseKeys = new Set(chunkedAuthCookies.map((name) => name.replace(/\.\d+$/, "")));
    allCookieNames
      .filter((name) => chunkedAuthCookies.includes(name) || baseKeys.has(name))
      .forEach((name) => {
        request.cookies.delete(name);
        response.cookies.set(name, "", { maxAge: 0, path: "/" });
      });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Self-hosted: nginx's default proxy header buffer is too small for
        // the full session (tokens + user object), causing "upstream sent
        // too big header" 502s. Storing only the tokens keeps the cookie
        // well under that limit — getUser() re-fetches the user anyway.
        // Must match the browser client (client.ts) and server.ts.
        encode: "tokens-only",
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isAdminPath(request.nextUrl.pathname)) {
    if (!user) {
      return NextResponse.redirect(
        new URL(`/admin-login?next=${encodeURIComponent(request.nextUrl.pathname)}`, siteOrigin)
      );
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || !["admin", "moderator"].includes(profile.role as string)) {
      return NextResponse.redirect(new URL("/", siteOrigin));
    }
  }

  return response;
}
