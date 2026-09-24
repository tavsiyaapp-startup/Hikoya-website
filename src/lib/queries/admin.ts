import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Chapter, Story, StoryTopTier, HeroSlide, Announcement } from "@/types/database";

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

// Exact counts for the /admin/activity date-range summary — separate from
// getRecentActivity because that one caps each source at `limit` rows
// before merging, so activity.length by type would undercount a range with
// more than `limit` events. "Published chapters" counts the chapters table
// directly (each chapter's own published_at), not stories.published_at —
// a story is only published once but can gain many chapters afterward.
export async function getActivityCounts(range?: { from?: string; to?: string }): Promise<{
  newUsers: number;
  publishedChapters: number;
  newComments: number;
}> {
  try {
    const admin = createAdminClient();

    let usersQuery = admin.from("profiles").select("id", { count: "exact", head: true });
    let chaptersQuery = admin
      .from("chapters")
      .select("id", { count: "exact", head: true })
      .not("published_at", "is", null);
    let commentsQuery = admin.from("comments").select("id", { count: "exact", head: true });

    if (range?.from) {
      usersQuery = usersQuery.gte("created_at", range.from);
      chaptersQuery = chaptersQuery.gte("published_at", range.from);
      commentsQuery = commentsQuery.gte("created_at", range.from);
    }
    if (range?.to) {
      usersQuery = usersQuery.lte("created_at", range.to);
      chaptersQuery = chaptersQuery.lte("published_at", range.to);
      commentsQuery = commentsQuery.lte("created_at", range.to);
    }

    const [{ count: newUsers }, { count: publishedChapters }, { count: newComments }] = await Promise.all([
      usersQuery,
      chaptersQuery,
      commentsQuery,
    ]);

    return { newUsers: newUsers ?? 0, publishedChapters: publishedChapters ?? 0, newComments: newComments ?? 0 };
  } catch {
    return { newUsers: 0, publishedChapters: 0, newComments: 0 };
  }
}

export type AdminUserSort = "newest" | "followers" | "stories";

export async function searchUsersAdmin(query?: string, sort: AdminUserSort = "newest") {
  try {
    const admin = createAdminClient();
    let q = admin.from("profiles").select("*");
    if (query) q = q.or(`display_name.ilike.%${query}%,username.ilike.%${query}%`);

    if (sort === "newest") {
      const { data } = await q.order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    }

    // Profiles don't carry a denormalized follower/story count to order by
    // in SQL, so popularity sorts rank in JS instead — fetch a generous
    // window of matching profiles first (same "cap, don't paginate" style as
    // the rest of this file), then rank the whole window before slicing to
    // the 100 actually shown, so an older but genuinely popular author isn't
    // hidden behind a newest-first cutoff.
    const { data: profiles } = await q.limit(500);
    const list = profiles ?? [];
    if (list.length === 0) return list;

    const ids = list.map((p) => p.id);
    const counts = sort === "followers" ? await getAuthorFollowerCounts(ids) : await getAuthorStoryCounts(ids);

    return list.sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0)).slice(0, 100);
  } catch {
    return [];
  }
}

// Batched per-author counts for the /admin/users list — one query for
// however many profiles are on screen rather than one per row, same
// pattern as getStoryChapterCounts below.
export async function getAuthorStoryCounts(userIds: string[]): Promise<Record<string, number>> {
  if (userIds.length === 0) return {};
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("stories").select("author_id").in("author_id", userIds).is("deleted_at", null);
    const counts: Record<string, number> = {};
    for (const row of data ?? []) counts[row.author_id] = (counts[row.author_id] ?? 0) + 1;
    return counts;
  } catch {
    return {};
  }
}

export async function getAuthorFollowerCounts(userIds: string[]): Promise<Record<string, number>> {
  if (userIds.length === 0) return {};
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("follows").select("author_id").in("author_id", userIds);
    const counts: Record<string, number> = {};
    for (const row of data ?? []) counts[row.author_id] = (counts[row.author_id] ?? 0) + 1;
    return counts;
  } catch {
    return {};
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

export async function getAllAnnouncementsAdmin(): Promise<Announcement[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("announcements").select("*").order("created_at", { ascending: false });
    return (data as Announcement[]) ?? [];
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

export type AdminStorySort = "newest" | "views" | "likes";

// Fetch window before the final sort+slice below — generous rather than
// paginated (same style as every other admin list here), but wide enough
// that sorting by views/likes actually surfaces the true top stories
// instead of just re-ordering whatever happened to be newest.
const STORY_FETCH_LIMIT = 500;

export async function getAllStoriesAdmin(
  statusFilter?: string,
  options?: { q?: string; sort?: AdminStorySort }
) {
  const title = options?.q?.trim();
  const sort = options?.sort ?? "newest";
  try {
    const admin = createAdminClient();
    let list: (Story & { author: { display_name: string } | null })[] = [];

    // The trash — soft-deleted by their author (deleted_at set, see
    // deleteStory in stories.ts) — is its own tab, kept out of every other
    // tab below rather than mixed into the regular status list.
    if (statusFilter === "deleted") {
      let deletedQuery = admin.from("stories").select(storySelect).not("deleted_at", "is", null);
      if (title) deletedQuery = deletedQuery.ilike("title", `%${title}%`);
      const { data } = await deletedQuery.limit(STORY_FETCH_LIMIT);
      list = data ?? [];
    } else if (statusFilter === "pending_review") {
      // A story keeps its own status once published — adding chapters to it
      // afterward never touches stories.status, only the new chapters' own
      // (pending_review by default). Filtering this tab by stories.status
      // alone would silently hide every "add chapters to an already-approved
      // story" submission from the pending queue, so it also pulls in any
      // story that merely *has* a pending chapter, whatever the story's own
      // status is.
      let pendingQuery = admin.from("stories").select(storySelect).eq("status", "pending_review").is("deleted_at", null);
      if (title) pendingQuery = pendingQuery.ilike("title", `%${title}%`);
      const [{ data: pendingStories }, { data: pendingChapterRows }] = await Promise.all([
        pendingQuery,
        admin.from("chapters").select("story_id").eq("status", "pending_review"),
      ]);

      const already = new Set((pendingStories ?? []).map((s) => s.id));
      const extraIds = [...new Set((pendingChapterRows ?? []).map((c) => c.story_id))].filter(
        (id) => !already.has(id)
      );

      let extraStories: typeof pendingStories = [];
      if (extraIds.length) {
        let extraQuery = admin.from("stories").select(storySelect).in("id", extraIds).is("deleted_at", null);
        if (title) extraQuery = extraQuery.ilike("title", `%${title}%`);
        extraStories = (await extraQuery).data ?? [];
      }

      list = [...(pendingStories ?? []), ...(extraStories ?? [])];
    } else {
      let generalQuery = admin.from("stories").select(storySelect).is("deleted_at", null);
      if (statusFilter) generalQuery = generalQuery.eq("status", statusFilter);
      if (title) generalQuery = generalQuery.ilike("title", `%${title}%`);
      const { data } = await generalQuery.limit(STORY_FETCH_LIMIT);
      list = data ?? [];
    }

    list.sort((a, b) => {
      if (sort === "views") return (b.view_count ?? 0) - (a.view_count ?? 0);
      if (sort === "likes") return (b.like_count ?? 0) - (a.like_count ?? 0);
      return +new Date(b.created_at) - +new Date(a.created_at);
    });

    return list.slice(0, 100);
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

export type ChapterForDownload = { order_index: number; title: string; content: string };

// Every chapter regardless of status (draft/pending_review/published/
// unlisted) — the .docx download is a staff-only tool for reading the story
// as it currently stands, same "admins can see drafts" reasoning as the
// adminHref path on StoryCard.
export async function getChaptersForDownload(storyId: string): Promise<ChapterForDownload[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("chapters")
      .select("order_index, title, content")
      .eq("story_id", storyId)
      .order("order_index", { ascending: true });
    return data ?? [];
  } catch {
    return [];
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

export type AdminCommentRow = {
  id: string;
  parent_id: string | null;
  text: string;
  like_count: number;
  is_spoiler: boolean;
  created_at: string;
  user: { display_name: string; username: string } | null;
  story: { id: string; title: string; slug: string } | null;
  chapter: { id: string; order_index: number; title: string } | null;
};

export type AdminCommentThread = AdminCommentRow & { replies: AdminCommentRow[] };

const adminCommentSelect =
  "id, parent_id, text, like_count, is_spoiler, created_at, user:profiles!comments_user_id_fkey(display_name, username), story:stories(id, title, slug), chapter:chapters(id, order_index, title)";

// Top-level comments only, paginated — each thread's replies are fetched
// separately (one extra query keyed off the page's parent ids) and nested
// underneath so "reply comes together with the comment it answers" holds
// even though replies themselves aren't paginated independently.
export async function getAllCommentsAdmin(page = 1, pageSize = 24): Promise<{ threads: AdminCommentThread[]; total: number }> {
  try {
    const admin = createAdminClient();
    const { count } = await admin.from("comments").select("id", { count: "exact", head: true }).is("parent_id", null);

    const from = (page - 1) * pageSize;
    const { data: topLevel } = await admin
      .from("comments")
      .select(adminCommentSelect)
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    const topIds = (topLevel ?? []).map((c) => c.id);
    const { data: replies } = topIds.length
      ? await admin.from("comments").select(adminCommentSelect).in("parent_id", topIds).order("created_at", { ascending: true })
      : { data: [] as AdminCommentRow[] };

    const repliesByParent = new Map<string, AdminCommentRow[]>();
    for (const r of (replies as AdminCommentRow[] | null) ?? []) {
      const arr = repliesByParent.get(r.parent_id as string) ?? [];
      arr.push(r);
      repliesByParent.set(r.parent_id as string, arr);
    }

    const threads = ((topLevel as AdminCommentRow[] | null) ?? []).map((c) => ({
      ...c,
      replies: repliesByParent.get(c.id) ?? [],
    }));

    return { threads, total: count ?? 0 };
  } catch {
    return { threads: [], total: 0 };
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
