import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export interface CurrentUser {
  id: string;
  email: string | null;
  profile: Profile | null;
}

// Guests are the default, working state of this app — every caller must
// tolerate `null`, including when Supabase itself is unreachable (e.g. the
// placeholder .env.local credentials used before a real project is wired up).
//
// Every layout AND every page under it calls this (layout needs it for the
// header/sidebar, the page needs it again for its own gating/data). Without
// `cache()`, that's 2 full Supabase round-trips (auth.getUser() + a profiles
// select) duplicated on every single navigation — 4 round-trips just to
// resolve who's logged in, before the page's own data even starts loading.
// `cache()` memoizes it per request so layout + page + anything else that
// calls it share one result.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return { id: user.id, email: user.email ?? null, profile: (profile as Profile) ?? null };
  } catch {
    return null;
  }
});
