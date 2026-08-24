import "server-only";
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
export async function getCurrentUser(): Promise<CurrentUser | null> {
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
}
