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

  // Self-hosted: nginx's response header buffer is smaller than a session
  // cookie can grow to — this bit us once already with the pre-fix format
  // (tokens-only encoding now keeps a fresh session around ~2KB, see
  // client.ts/server.ts), and nothing stops it happening again later (more
  // user_metadata/app_metadata, added claims, etc. all inflate the JWT
  // stored in the cookie). Rather than special-case "the old format", treat
  // any auth cookie that's already grown dangerously large as a standing
  // condition to guard against: Supabase itself only chunks a cookie past
  // MAX_CHUNK_SIZE (3180 bytes), which can already be bigger than nginx's
  // buffer, so a lower proactive limit here catches it before that.
  // Clearing it before the SDK reads it just signs the visitor out cleanly
  // — they log back in and get a fresh, small cookie — instead of the
  // request dying with "upstream sent too big header".
  const AUTH_COOKIE_SAFE_LIMIT = 2500;
  const allCookies = request.cookies.getAll();
  const oversizedAuthCookies = allCookies
    .filter(
      (c) =>
        /-auth-token\.\d+$/.test(c.name) ||
        (/-auth-token$/.test(c.name) && c.value.length > AUTH_COOKIE_SAFE_LIMIT)
    )
    .map((c) => c.name);
  if (oversizedAuthCookies.length > 0) {
    const baseKeys = new Set(oversizedAuthCookies.map((name) => name.replace(/\.\d+$/, "")));
    allCookies
      .map((c) => c.name)
      .filter((name) => oversizedAuthCookies.includes(name) || baseKeys.has(name))
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
