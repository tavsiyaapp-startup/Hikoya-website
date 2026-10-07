import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth/config";

// Exposes Better Auth's whole REST API (sign-in, sign-up, session, OAuth
// callbacks, email OTP, ...) under /api/auth/*. Nothing on the live site
// links here yet — the sign-in forms still call Supabase directly.
//
// toNextJsHandler(getAuth()) is not called at module scope: getAuth()
// builds the database connection, and `next build` imports every route to
// collect its metadata, which would run that at build time instead of on
// a real request — see the comment on getAuth() in ./config.ts.
export async function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}

export async function PATCH(request: Request) {
  return toNextJsHandler(getAuth()).PATCH(request);
}

export async function PUT(request: Request) {
  return toNextJsHandler(getAuth()).PUT(request);
}

export async function DELETE(request: Request) {
  return toNextJsHandler(getAuth()).DELETE(request);
}
