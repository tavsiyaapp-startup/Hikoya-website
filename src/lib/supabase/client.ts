import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseConfigured } from "./config";

export function createClient() {
  assertSupabaseConfigured();
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
