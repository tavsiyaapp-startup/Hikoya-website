import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("*").eq("username", username).single();
    return (data as Profile) ?? null;
  } catch {
    return null;
  }
}

export async function getAuthorStoryCount(authorId: string) {
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("stories")
      .select("id", { count: "exact", head: true })
      .eq("author_id", authorId)
      .eq("status", "published");
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getAuthorAchievements(userId: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("user_achievements")
      .select("achievement:achievements(code, title_ru, title_uz)")
      .eq("user_id", userId);
    return data ?? [];
  } catch {
    return [];
  }
}
