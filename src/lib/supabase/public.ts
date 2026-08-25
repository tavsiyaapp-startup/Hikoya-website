import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { assertSupabaseConfigured } from "./config";

// Stateless client (no cookies, no session) for reads that are safe to run
// through Next.js's `unstable_cache` — i.e. queries that already filter to
// publicly-visible rows (status = 'published') so the result is identical
// for every viewer. `unstable_cache` can't call cookies() internally (it's
// shared across requests/users), so these queries can't use the normal
// per-request SSR client — but they don't need to, since RLS grants the
// same published-row access to anon as to any logged-in viewer.
export function createPublicClient() {
  assertSupabaseConfigured();
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
