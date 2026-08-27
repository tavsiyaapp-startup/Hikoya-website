import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { StoryCard } from "@/lib/queries/stories";

export async function getUserStoryState(userId: string | undefined, storyId: string) {
  if (!userId)
    return { liked: false, bookmarked: false, readingStatus: null as string | null, continueChapterId: null as string | null };
  try {
    const supabase = await createClient();
    const [{ data: like }, { data: bookmark }, { data: status }, { data: progress }] = await Promise.all([
      supabase
        .from("likes")
        .select("id")
        .eq("user_id", userId)
        .eq("target_type", "story")
        .eq("target_id", storyId)
        .maybeSingle(),
      supabase.from("bookmarks").select("id").eq("user_id", userId).eq("story_id", storyId).maybeSingle(),
      supabase.from("reading_statuses").select("status").eq("user_id", userId).eq("story_id", storyId).maybeSingle(),
      supabase.from("reading_progress").select("chapter_id").eq("user_id", userId).eq("story_id", storyId).maybeSingle(),
    ]);
    return {
      liked: Boolean(like),
      bookmarked: Boolean(bookmark),
      readingStatus: status?.status ?? null,
      continueChapterId: progress?.chapter_id ?? null,
    };
  } catch {
    return { liked: false, bookmarked: false, readingStatus: null, continueChapterId: null };
  }
}

// Every chapter of this story the user has opened at least once — drives
// the "read" mark on each row of the chapters list. Separate from
// reading_progress (single latest chapter per story, used for the
// continue-reading button above) since this needs the full set, not just
// the most recent one.
export async function getReadChapterIds(userId: string | undefined, storyId: string): Promise<Set<string>> {
  if (!userId) return new Set();
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("chapter_reads").select("chapter_id").eq("user_id", userId).eq("story_id", storyId);
    return new Set((data ?? []).map((r) => r.chapter_id as string));
  } catch {
    return new Set();
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

export type FollowedAuthorGroup = {
  author: { id: string; username: string; display_name: string; avatar_url: string | null };
  stories: StoryCard[];
};

// Powers /library's "Мои подписанные писатели" tab — every author the user
// follows, each with their currently public/published stories underneath.
// Authors with nothing published yet still show up (empty stories array) so
// "who am I following" stays accurate even before they've posted anything.
export async function getFollowedAuthorsWithStories(userId: string): Promise<FollowedAuthorGroup[]> {
  try {
    const supabase = await createClient();
    const { data: follows } = await supabase
      .from("follows")
      .select("author:profiles!follows_author_id_fkey(id, username, display_name, avatar_url)")
      .eq("follower_id", userId)
      .order("created_at", { ascending: false });

    const authors = (follows ?? [])
      .map((f) => f.author as unknown as FollowedAuthorGroup["author"] | null)
      .filter((a): a is FollowedAuthorGroup["author"] => Boolean(a));
    if (authors.length === 0) return [];

    const { data: stories } = await supabase
      .from("stories")
      .select("*, author:profiles!stories_author_id_fkey(username, display_name)")
      .in(
        "author_id",
        authors.map((a) => a.id)
      )
      .eq("status", "published")
      .eq("visibility", "public")
      .order("published_at", { ascending: false });

    const storiesByAuthor = new Map<string, StoryCard[]>();
    for (const story of (stories ?? []) as StoryCard[]) {
      const arr = storiesByAuthor.get(story.author_id) ?? [];
      arr.push(story);
      storiesByAuthor.set(story.author_id, arr);
    }

    return authors.map((author) => ({ author, stories: storiesByAuthor.get(author.id) ?? [] }));
  } catch {
    return [];
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

export type StoryCommentRow = CommentRow & {
  chapter: { order_index: number; title: string } | null;
};

export type StoryCommentThread = StoryCommentRow & { replies: StoryCommentRow[] };

export async function getStoryComments(storyId: string, limit = 300): Promise<StoryCommentThread[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("comments")
      .select("*, user:profiles(display_name), chapter:chapters!inner(order_index, title, story_id)")
      .eq("chapter.story_id", storyId)
      .order("created_at", { ascending: true })
      .limit(limit);
    const all = (data as StoryCommentRow[]) ?? [];

    const repliesByParent = new Map<string, StoryCommentRow[]>();
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
