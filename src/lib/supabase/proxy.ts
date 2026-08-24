import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "./config";

// Refreshes the Supabase auth session cookies on every request and gates
// /admin to signed-in staff. Called from proxy.ts (Next.js 16's renamed
// middleware.ts — same mechanics, request-scoped, no DB calls beyond the
// lightweight profile-role lookup needed for the admin gate).
export async function updateSession(request: NextRequest) {
  // Runs on every request — never let an unconfigured/unreachable Supabase
  // project hang the whole app behind a slow DNS/connect timeout.
  if (!isSupabaseConfigured()) {
    if (request.nextUrl.pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/onboarding?next=/admin", request.url));
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
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

  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL("/onboarding?next=/admin", request.url));
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || !["admin", "moderator"].includes(profile.role as string)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}
