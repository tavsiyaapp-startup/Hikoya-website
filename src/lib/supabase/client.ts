import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseConfigured } from "./config";

export function createClient() {
  assertSupabaseConfigured();
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Self-hosted: nginx's default proxy header buffer is too small for the
      // full session (tokens + user object), causing "upstream sent too big
      // header" 502s. Storing only the tokens keeps the cookie well under
      // that limit — the user object is refetched via getUser() anyway.
      // Must match the same setting on the server client (server.ts, proxy.ts).
      cookies: { encode: "tokens-only" },
    }
  );
}
