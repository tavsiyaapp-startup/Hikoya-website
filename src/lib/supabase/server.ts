import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { assertSupabaseConfigured } from "./config";

// Use inside Server Components, Server Actions, and Route Handlers.
// Server Components can't set cookies, so setAll is a no-op there —
// session refresh cookies are written by proxy.ts instead.
export async function createClient() {
  assertSupabaseConfigured();
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Self-hosted: nginx's default proxy header buffer is too small for
        // the full session (tokens + user object), causing "upstream sent
        // too big header" 502s. Storing only the tokens keeps the cookie
        // well under that limit — getUser() re-fetches the user anyway.
        // Must match the browser client (client.ts) and proxy.ts.
        encode: "tokens-only",
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render — ignore, proxy.ts refreshes the session.
          }
        },
      },
    }
  );
}
