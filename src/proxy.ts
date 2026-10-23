import { NextResponse, type NextRequest } from "next/server";
import { getStaffSession } from "@/server/auth/staff";

// Next.js 16's renamed middleware.ts. Its only job now is gating /admin to
// signed-in staff (Better Auth session). It used to also refresh a Supabase
// auth cookie on every public request — nothing reads a Supabase session
// anymore, so that part is gone.

// "/admin" and "/admin/..." are gated, but NOT "/admin-login" — a plain
// startsWith("/admin") also matches "/admin-login" itself, which would
// bounce a signed-out visitor away from the login page before they could
// ever use it.
function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

// Self-hosted behind nginx: the reverse proxy doesn't forward the original
// Host header, so building redirects off `request.url` resolves to the
// app's internal localhost address instead of the public site — use the
// known public URL as the base instead.
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://hikoya.org";

export async function proxy(request: NextRequest) {
  if (!isAdminPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  const result = await getStaffSession();
  if (result.status === "signed-out") {
    return NextResponse.redirect(
      new URL(`/admin-login?next=${encodeURIComponent(request.nextUrl.pathname)}`, siteOrigin)
    );
  }
  if (result.status === "not-staff") {
    return NextResponse.redirect(new URL("/", siteOrigin));
  }
  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|uploads/|icons/|fonts/|sw.js|offline.html|manifest.webmanifest).*)"],
};
