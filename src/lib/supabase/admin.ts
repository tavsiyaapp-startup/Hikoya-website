import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { assertSupabaseConfigured } from "./config";

// Service-role client — bypasses Row Level Security. Server-only.
// Use only inside /admin routes and trusted server code, never expose to the client.
export function createAdminClient() {
  assertSupabaseConfigured();
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
