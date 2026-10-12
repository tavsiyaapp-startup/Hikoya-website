import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";

// Username (the @handle in profile urls; not used for signing in) derived from
// the email's local part, the same way the old Supabase trigger
// handle_new_user() did (supabase/migrations/0005_auth_trigger.sql): keep
// letters, digits and "_", fall back to "user", and append 1, 2, ... until
// it's free. Users never pick it — it's only an internal handle.
export async function uniqueUsernameFromEmail(email: string): Promise<string> {
  const db = getDb();
  const base = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "") || "user";
  let candidate = base;
  let suffix = 0;
  for (;;) {
    const [existing] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, candidate)).limit(1);
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
}
