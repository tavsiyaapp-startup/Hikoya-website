import "server-only";
import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import type { Viewer } from "@/server/authz/policy";

// Loads the id/role/status triple that every policy check in
// src/server/authz/policy.ts needs — never the full profile row, so a
// forgotten field there can't accidentally widen what a check sees.
export async function loadViewer(db: DbOrTx, userId: string | null | undefined): Promise<Viewer | null> {
  if (!userId) return null;
  const [row] = await db
    .select({ id: profiles.id, role: profiles.role, status: profiles.status })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return row ?? null;
}
