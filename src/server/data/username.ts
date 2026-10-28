import "server-only";
import { randomBytes } from "crypto";
import { and, ne, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";

// A user may change their own @username once a week (profile.ts enforces it).
export const USERNAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

export type UsernameError = "format" | "reserved" | "taken";

// Validates a user-chosen @handle and returns the trimmed value or why it
// was rejected. Letters, digits and "_", 3–30 chars. Case is PRESERVED
// (a pseudonym may want a capital), but uniqueness and every lookup compare
// case-insensitively (isUsernameTaken below, getProfileByUsername), so two
// handles differing only in case can't both exist.
export function validateUsername(raw: string): { ok: true; value: string } | { ok: false; error: UsernameError } {
  const value = raw.trim();
  if (!new RegExp(`^[A-Za-z0-9_]{${USERNAME_MIN},${USERNAME_MAX}}$`).test(value)) {
    return { ok: false, error: "format" };
  }
  if (isReserved(value)) return { ok: false, error: "reserved" };
  return { ok: true, value };
}

// True when some OTHER account already holds this handle (case-insensitive).
export async function isUsernameTaken(name: string, excludeId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(sql`lower(${profiles.username}) = ${name.toLowerCase()}`, ne(profiles.id, excludeId)))
    .limit(1);
  return Boolean(row);
}

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
