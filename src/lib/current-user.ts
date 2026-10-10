import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import type { Profile } from "@/types/database";

export interface CurrentUser {
  id: string;
  email: string | null;
  profile: Profile | null;
}

// Guests are the default, working state of this app — every caller must
// tolerate `null`.
//
// Every layout AND every page under it calls this (layout needs it for the
// header/sidebar, the page needs it again for its own gating/data). Without
// `cache()`, that's 2 full round-trips (session + a profiles select)
// duplicated on every single navigation. `cache()` memoizes it per request
// so layout + page + anything else that calls it share one result.
//
// Reads a Better Auth session now, not Supabase — this is the single choke
// point every caller (24+ files) goes through, so moving identity here
// moves it everywhere at once. Needs the public login forms
// (src/components/auth/AuthButtons.tsx etc.) to actually issue a Better
// Auth session for this to resolve to anyone; both moved together.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    const session = await getAuth().api.getSession({ headers: await headers() });
    if (!session) return null;

    const db = getDb();
    const [row] = await db.select().from(profiles).where(eq(profiles.id, session.user.id)).limit(1);
    if (!row) return { id: session.user.id, email: session.user.email ?? null, profile: null };

    const profile: Profile = {
      ...row,
      onboarded_at: row.onboarded_at ? row.onboarded_at.toISOString() : null,
      created_at: row.created_at.toISOString(),
    };

    return { id: session.user.id, email: session.user.email ?? null, profile };
  } catch {
    return null;
  }
});
