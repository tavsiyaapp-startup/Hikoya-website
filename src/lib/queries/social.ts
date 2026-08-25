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

export type CommentRow = {
  id: string;
  chapter_id: string;
  user_id: string;
  parent_id: string | null;
  text: string;
  like_count: number;
  created_at: string;
  user: { display_name: string } | null;
};

export type CommentWithReplies = CommentRow & { replies: CommentRow[] };

export async function getChapterComments(chapterId: string): Promise<CommentWithReplies[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("comments")
      .select("*, user:profiles(display_name)")
      .eq("chapter_id", chapterId)
      .order("created_at", { ascending: true })
      .limit(300);
    const all = (data as CommentRow[]) ?? [];

    const repliesByParent = new Map<string, CommentRow[]>();
    for (const c of all) {
      if (!c.parent_id) continue;
      const arr = repliesByParent.get(c.parent_id) ?? [];
      arr.push(c);
      repliesByParent.set(c.parent_id, arr);
    }

    return all
      .filter((c) => !c.parent_id)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .map((c) => ({ ...c, replies: repliesByParent.get(c.id) ?? [] }));
  } catch {
    return [];
  }
}

export async function getLikedCommentIds(userId: string | undefined, commentIds: string[]): Promise<Set<string>> {
  if (!userId || commentIds.length === 0) return new Set();
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("likes")
      .select("target_id")
      .eq("user_id", userId)
      .eq("target_type", "comment")
      .in("target_id", commentIds);
    return new Set((data ?? []).map((r) => r.target_id as string));
  } catch {
    return new Set();
  }
}
