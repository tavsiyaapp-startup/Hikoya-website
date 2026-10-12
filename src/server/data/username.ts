import "server-only";
import { randomBytes } from "crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";

// Handles that would let someone pass for staff or the site itself.
const RESERVED = new Set([
  "admin", "administrator", "moderator", "mod", "support", "help", "hikoya",
  "staff", "system", "root", "official", "team", "security", "info", "noreply",
]);

function isReserved(name: string): boolean {
  const lower = name.toLowerCase();
  return RESERVED.has(lower) || lower.startsWith("admin") || lower.startsWith("moder") || lower.startsWith("hikoya");
}

async function isTaken(name: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: profiles.id })
    .from(profiles)
    .where(sql`lower(${profiles.username}) = ${name.toLowerCase()}`)
    .limit(1);
  return Boolean(row);
}

// Username (the @handle in profile urls; not used for signing in) derived from
// the email's local part, the same way the old Supabase trigger
// handle_new_user() did (supabase/migrations/0005_auth_trigger.sql): keep
// letters, digits and "_", lowercase. Reserved staff-like names and names
// that differ only in case from an existing one get a suffix; after a few
// numbered tries a random suffix is used, so two people signing up at the
// same moment with the same local part don't both end up on the same name.
export async function uniqueUsernameFromEmail(email: string): Promise<string> {
  let base = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase().slice(0, 30) || "user";
  if (isReserved(base)) base = `${base}_user`;
  if (!(await isTaken(base))) return base;
  for (let suffix = 1; suffix <= 20; suffix++) {
    const candidate = `${base}${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  for (;;) {
    const candidate = `${base}_${randomBytes(3).toString("hex")}`;
    if (!(await isTaken(candidate))) return candidate;
  }
}
