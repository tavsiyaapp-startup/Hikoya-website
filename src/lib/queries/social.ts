import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getUserStoryState(userId: string | undefined, storyId: string) {
  if (!userId) return { liked: false, bookmarked: false };
  try {
    const supabase = await createClient();
    const [{ data: like }, { data: bookmark }] = await Promise.all([
      supabase
        .from("likes")
        .select("id")
        .eq("user_id", userId)
        .eq("target_type", "story")
        .eq("target_id", storyId)
        .maybeSingle(),
      supabase.from("bookmarks").select("id").eq("user_id", userId).eq("story_id", storyId).maybeSingle(),
    ]);
    return { liked: Boolean(like), bookmarked: Boolean(bookmark) };
  } catch {
    return { liked: false, bookmarked: false };
  }
}

export async function isFollowingAuthor(userId: string | undefined, authorId: string) {
  if (!userId) return false;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", userId)
      .eq("author_id", authorId)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function getFollowerCount(authorId: string) {
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("author_id", authorId);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getChapterComments(chapterId: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("comments")
      .select("*, user:profiles(display_name)")
      .eq("chapter_id", chapterId)
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  } catch {
    return [];
  }
}
