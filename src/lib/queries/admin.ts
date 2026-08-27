import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Chapter, Story, StoryTopTier, HeroSlide } from "@/types/database";

// Admin panel reads always use the service-role client — staff need to see
// everything regardless of RLS (draft stories, all users).
// There's no dedicated audit-log table yet, so the dashboard's "recent
// activity" feed is derived from recent stories/users/comments instead of a
// true event log.

export async function getAdminStats() {
  try {
    const admin = createAdminClient();
    const [{ count: storyCount }, { count: userCount }, { data: views }, { count: commentCount }] =
      await Promise.all([
        admin.from("stories").select("id", { count: "exact", head: true }),
        admin.from("profiles").select("id", { count: "exact", head: true }),
        admin.from("stories").select("view_count"),
        admin.from("comments").select("id", { count: "exact", head: true }),
      ]);
    const totalViews = (views ?? []).reduce((sum, s) => sum + (s.view_count ?? 0), 0);
    return {
      storyCount: storyCount ?? 0,
      userCount: userCount ?? 0,
      totalViews,
      commentCount: commentCount ?? 0,
    };
  } catch {
    return { storyCount: 0, userCount: 0, totalViews: 0, commentCount: 0 };
  }
}

export async function getRecentStoriesAdmin(limit = 6) {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("stories")
      .select("id, title, slug, cover_url, status, created_at, author:profiles!stories_author_id_fkey(display_name)")
      .order("created_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getRecentUsersAdmin(limit = 6) {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("id, display_name, username, created_at, status, role")
      .order("created_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  } catch {
    return [];
  }
}

export type AdminActivityItem =
  | { type: "story_published"; id: string; actorName: string; targetTitle: string; timestamp: string }
  | { type: "new_comment"; id: string; actorName: string; targetTitle: string; timestamp: string }
  | { type: "new_user"; id: string; actorName: string; timestamp: string };

// No dedicated audit-log table — this merges the three event types the
// dashboard (and the full /admin/activity page) cares about (newly
// published story, new comment, new registration) from their own tables,
// sorted by timestamp. `range` filters each source query independently
// before the merge, so a date range still returns up to `limit` items of
// each type rather than `limit` total pre-filter.
export async function getRecentActivity(
  limit = 8,
  range?: { from?: string; to?: string }
): Promise<AdminActivityItem[]> {
  try {
    const admin = createAdminClient();

    let storiesQuery = admin
      .from("stories")
      .select("id, title, published_at, author:profiles!stories_author_id_fkey(display_name)")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false });
    let commentsQuery = admin
      .from("comments")
      .select("id, created_at, user:profiles!comments_user_id_fkey(display_name), chapter:chapters(story:stories(title))")
      .order("created_at", { ascending: false });
    let usersQuery = admin.from("profiles").select("id, display_name, created_at").order("created_at", { ascending: false });

    if (range?.from) {
      storiesQuery = storiesQuery.gte("published_at", range.from);
      commentsQuery = commentsQuery.gte("created_at", range.from);
      usersQuery = usersQuery.gte("created_at", range.from);
    }
    if (range?.to) {
      storiesQuery = storiesQuery.lte("published_at", range.to);
      commentsQuery = commentsQuery.lte("created_at", range.to);
      usersQuery = usersQuery.lte("created_at", range.to);
    }

    const [storiesRes, commentsRes, usersRes] = await Promise.all([
      storiesQuery.limit(limit),
      commentsQuery.limit(limit),
      usersQuery.limit(limit),
    ]);

    const items: AdminActivityItem[] = [];

    for (const s of storiesRes.data ?? []) {
      const author = s.author as unknown as { display_name: string } | null;
      if (!author || !s.published_at) continue;
      items.push({ type: "story_published", id: s.id, actorName: author.display_name, targetTitle: s.title, timestamp: s.published_at });
    }

    for (const c of commentsRes.data ?? []) {
      const user = c.user as unknown as { display_name: string } | null;
      const story = (c.chapter as unknown as { story: { title: string } | null } | null)?.story;
      if (!user || !story) continue;
      items.push({ type: "new_comment", id: c.id, actorName: user.display_name, targetTitle: story.title, timestamp: c.created_at });
    }

    for (const u of usersRes.data ?? []) {
      items.push({ type: "new_user", id: u.id, actorName: u.display_name, timestamp: u.created_at });
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items.slice(0, limit);
  } catch {
    return [];
  }
}

export async function searchUsersAdmin(query?: string) {
  try {
    const admin = createAdminClient();
    let q = admin.from("profiles").select("*").order("created_at", { ascending: false });
    if (query) q = q.or(`display_name.ilike.%${query}%,username.ilike.%${query}%`);
    const { data } = await q.limit(100);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getAllAchievements() {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("achievements").select("*").order("title_ru");
    return data ?? [];
  } catch {
    return [];
  }
}

// One query for the whole /admin/users list rather than one per row.
export async function getUserAchievementsMap(userIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (userIds.length === 0) return map;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("user_achievements")
      .select("user_id, achievement_id")
      .in("user_id", userIds);
    for (const row of data ?? []) {
      const list = map.get(row.user_id) ?? [];
      list.push(row.achievement_id);
      map.set(row.user_id, list);
    }
    return map;
  } catch {
    return map;
  }
}

export async function getAllHeroSlidesAdmin(): Promise<HeroSlide[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("hero_slides").select("*").order("created_at", { ascending: true });
    return (data as HeroSlide[]) ?? [];
  } catch {
    return [];
  }
}

export async function searchStoriesForFeaturedAdmin(query?: string) {
  try {
    const admin = createAdminClient();
    let q = admin
      .from("stories")
      .select("id, title, author:profiles!stories_author_id_fkey(display_name)")
      .eq("status", "published")
      .order("title", { ascending: true });
    if (query) q = q.ilike("title", `%${query}%`);
    const { data } = await q.limit(100);
    return data ?? [];
  } catch {
    return [];
  }
}

// One query for the whole /admin/featured list rather than one per row.
export async function getFeaturedTiersMap(storyIds: string[]): Promise<Map<string, Set<StoryTopTier>>> {
  const map = new Map<string, Set<StoryTopTier>>();
  if (storyIds.length === 0) return map;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("featured_stories").select("story_id, tier").in("story_id", storyIds);
    for (const row of data ?? []) {
      const set = map.get(row.story_id) ?? new Set<StoryTopTier>();
      set.add(row.tier);
      map.set(row.story_id, set);
    }
    return map;
  } catch {
    return map;
  }
}

const storySelect = "*, author:profiles!stories_author_id_fkey(display_name)";

export async function getAllStoriesAdmin(statusFilter?: string) {
  try {
    const admin = createAdminClient();

    // A story keeps its own status once published — adding chapters to it
    // afterward never touches stories.status, only the new chapters' own
    // (pending_review by default). Filtering this tab by stories.status
    // alone would silently hide every "add chapters to an already-approved
    // story" submission from the pending queue, so it also pulls in any
    // story that merely *has* a pending chapter, whatever the story's own
    // status is.
    if (statusFilter === "pending_review") {
      const [{ data: pendingStories }, { data: pendingChapterRows }] = await Promise.all([
        admin.from("stories").select(storySelect).eq("status", "pending_review"),
        admin.from("chapters").select("story_id").eq("status", "pending_review"),
      ]);

      const already = new Set((pendingStories ?? []).map((s) => s.id));
      const extraIds = [...new Set((pendingChapterRows ?? []).map((c) => c.story_id))].filter(
        (id) => !already.has(id)
      );

      const extraStories = extraIds.length
        ? ((await admin.from("stories").select(storySelect).in("id", extraIds)).data ?? [])
        : [];

      return [...(pendingStories ?? []), ...extraStories]
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .slice(0, 100);
    }

    let q = admin.from("stories").select(storySelect).order("created_at", { ascending: false });
    if (statusFilter) q = q.eq("status", statusFilter);
    const { data } = await q.limit(100);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getStoryChapterCounts(storyIds: string[]) {
  if (storyIds.length === 0) return {} as Record<string, number>;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("chapters").select("story_id").in("story_id", storyIds);
    const counts: Record<string, number> = {};
    for (const row of data ?? []) counts[row.story_id] = (counts[row.story_id] ?? 0) + 1;
    return counts;
  } catch {
    return {};
  }
}

// Surfaces stories whose OWN status is e.g. "published" but that have
// chapters awaiting moderation — see getAllStoriesAdmin's pending_review
// case above for why this can't be inferred from stories.status alone.
export async function getPendingChapterCounts(storyIds: string[]) {
  if (storyIds.length === 0) return {} as Record<string, number>;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("chapters")
      .select("story_id")
      .eq("status", "pending_review")
      .in("story_id", storyIds);
    const counts: Record<string, number> = {};
    for (const row of data ?? []) counts[row.story_id] = (counts[row.story_id] ?? 0) + 1;
    return counts;
  } catch {
    return {};
  }
}

// Moderation reads always go through the admin client — staff need to see
// a story/chapter regardless of its status (pending_review, draft after a
// rejection, etc), and this view is intentionally decoupled from the
// author's own /manage page: admins can read here, never edit, and their
// reads never touch view_count (no ChapterReadingRecorder on these routes).

export type StoryForModeration = Story & {
  author: { id: string; username: string; display_name: string } | null;
};

export async function getStoryForModeration(id: string): Promise<StoryForModeration | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("stories")
      .select("*, author:profiles!stories_author_id_fkey(id, username, display_name)")
      .eq("id", id)
      .single();
    return (data as StoryForModeration) ?? null;
  } catch {
    return null;
  }
}

export type ChapterListItem = Pick<
  Chapter,
  "id" | "story_id" | "order_index" | "title" | "word_count" | "status" | "rejection_reason" | "updated_at"
>;

export async function getChaptersForModeration(storyId: string): Promise<ChapterListItem[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("chapters")
      .select("id, story_id, order_index, title, word_count, status, rejection_reason, updated_at")
      .eq("story_id", storyId)
      .order("order_index", { ascending: true });
    return (data as ChapterListItem[]) ?? [];
  } catch {
    return [];
  }
}

export async function getChapterForModeration(chapterId: string): Promise<Chapter | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("chapters").select("*").eq("id", chapterId).single();
    return (data as Chapter) ?? null;
  } catch {
    return null;
  }
}

export async function getAllRequestsAdmin(statusFilter?: string) {
  try {
    const admin = createAdminClient();
    let q = admin
      .from("requests")
      .select("*, from_user:profiles!requests_from_user_id_fkey(display_name)")
      .order("created_at", { ascending: false });
    if (statusFilter) q = q.eq("status", statusFilter);
    const { data } = await q.limit(100);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getAllCollectionsAdmin() {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("collections")
      .select("*, owner:profiles!collections_owner_id_fkey(display_name)")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getCollectionByIdAdmin(id: string) {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("collections").select("*").eq("id", id).single();
    return data;
  } catch {
    return null;
  }
}

export async function getCollectionItemIds(collectionId: string): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("collection_items").select("story_id").eq("collection_id", collectionId);
    return (data ?? []).map((r) => r.story_id);
  } catch {
    return [];
  }
}

export async function getAllStoriesForAdminPicker() {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("stories")
      .select("id, title, author:profiles!stories_author_id_fkey(display_name)")
      .order("title", { ascending: true });
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getPlatformSettingsAdmin() {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("platform_settings").select("*").eq("id", 1).single();
    return data;
  } catch {
    return null;
  }
}
