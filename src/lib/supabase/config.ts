// A placeholder .env.local (no real Supabase project yet) points at a host
// that doesn't resolve, so a fetch() to it can hang far longer than any
// try/catch is willing to wait. Fail fast and synchronously instead so every
// query function's catch block fires immediately and pages render their
// empty/guest state rather than hanging the request.
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return url.length > 0 && !url.includes("placeholder");
}

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured (placeholder .env.local) — see .env.local.example");
  }
}
