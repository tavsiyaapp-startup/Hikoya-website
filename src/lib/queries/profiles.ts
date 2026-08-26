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

export async function getAuthorTotals(authorId: string) {
  try {
    const supabase = await createClient();
    const { data: stories } = await supabase
      .from("stories")
      .select("id, like_count")
      .eq("author_id", authorId)
      .eq("status", "published");
    const storyRows = stories ?? [];
    const totalLikes = storyRows.reduce((sum, s) => sum + (s.like_count ?? 0), 0);

    let totalChapters = 0;
    const storyIds = storyRows.map((s) => s.id);
    if (storyIds.length > 0) {
      const { count } = await supabase
        .from("chapters")
        .select("id", { count: "exact", head: true })
        .in("story_id", storyIds)
        .eq("status", "published");
      totalChapters = count ?? 0;
    }

    return { totalLikes, totalChapters };
  } catch {
    return { totalLikes: 0, totalChapters: 0 };
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
