import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, isNotNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  achievements,
  chapters,
  collectionItems,
  collections,
  comments,
  featuredStories,
  follows,
  heroSlides,
  announcements as announcementsTable,
  platformSettings,
  profiles,
  requests,
  stories,
  userAchievements,
} from "@/server/db/schema";
import type { Achievement, Chapter, Story, StoryTopTier, HeroSlide, Announcement } from "@/types/database";

// Admin panel reads used to always use the service-role client — now
// Drizzle/pg directly (never through Supabase's PostgREST/RLS layer at
// all), so "staff see everything regardless of RLS" is simply true by
// construction, nothing to opt into per query anymore.
// There's no dedicated audit-log table yet, so the dashboard's "recent
// activity" feed is derived from recent stories/users/comments instead of a
// true event log.

function toISO(d: Date): string {
  return d.toISOString();
}

function storyRowToStory(row: typeof stories.$inferSelect): Story {
  return {
    ...row,
    created_at: toISO(row.created_at),
    updated_at: toISO(row.updated_at),
    published_at: row.published_at ? toISO(row.published_at) : null,
    deleted_at: row.deleted_at ? toISO(row.deleted_at) : null,
  };
}

function chapterRowToChapter(row: typeof chapters.$inferSelect): Chapter {
  return {
    ...row,
    created_at: toISO(row.created_at),
    updated_at: toISO(row.updated_at),
    published_at: row.published_at ? toISO(row.published_at) : null,
  };
}

export async function getAdminStats() {
  try {
    const db = getDb();
    const [[{ storyCount }], [{ userCount }], [{ totalViews }], [{ commentCount }]] = await Promise.all([
      db.select({ storyCount: count() }).from(stories),
      db.select({ userCount: count() }).from(profiles),
      db.select({ totalViews: sql<number>`coalesce(sum(${stories.view_count}), 0)` }).from(stories),
      db.select({ commentCount: count() }).from(comments),
    ]);
    return { storyCount, userCount, totalViews: Number(totalViews), commentCount };
  } catch {
    return { storyCount: 0, userCount: 0, totalViews: 0, commentCount: 0 };
  }
}

export async function getRecentStoriesAdmin(limit = 6) {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: stories.id,
        title: stories.title,
        slug: stories.slug,
        cover_url: stories.cover_url,
        status: stories.status,
        created_at: stories.created_at,
        author: { display_name: profiles.display_name },
      })
      .from(stories)
      .innerJoin(profiles, eq(stories.author_id, profiles.id))
      .orderBy(desc(stories.created_at))
      .limit(limit);
    return rows.map((r) => ({ ...r, created_at: toISO(r.created_at) }));
  } catch {
    return [];
  }
}

export async function getRecentUsersAdmin(limit = 6) {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: profiles.id,
        display_name: profiles.display_name,
        username: profiles.username,
        created_at: profiles.created_at,
        status: profiles.status,
        role: profiles.role,
      })
      .from(profiles)
      .orderBy(desc(profiles.created_at))
      .limit(limit);
    return rows.map((r) => ({ ...r, created_at: toISO(r.created_at) }));
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
    const db = getDb();

    const storyConds = [isNotNull(stories.published_at)];
    if (range?.from) storyConds.push(gte(stories.published_at, new Date(range.from)));
    if (range?.to) storyConds.push(lte(stories.published_at, new Date(range.to)));

    const commentConds = [];
    if (range?.from) commentConds.push(gte(comments.created_at, new Date(range.from)));
    if (range?.to) commentConds.push(lte(comments.created_at, new Date(range.to)));

    const userConds = [];
    if (range?.from) userConds.push(gte(profiles.created_at, new Date(range.from)));
    if (range?.to) userConds.push(lte(profiles.created_at, new Date(range.to)));

    const [storiesRows, commentsRows, usersRows] = await Promise.all([
      db
        .select({ id: stories.id, title: stories.title, published_at: stories.published_at, author: { display_name: profiles.display_name } })
        .from(stories)
        .innerJoin(profiles, eq(stories.author_id, profiles.id))
        .where(and(...storyConds))
        .orderBy(desc(stories.published_at))
        .limit(limit),
      db
        .select({
          id: comments.id,
          created_at: comments.created_at,
          user: { display_name: profiles.display_name },
          storyTitle: stories.title,
        })
        .from(comments)
        .innerJoin(profiles, eq(comments.user_id, profiles.id))
        .innerJoin(stories, eq(comments.story_id, stories.id))
        .where(commentConds.length ? and(...commentConds) : undefined)
        .orderBy(desc(comments.created_at))
        .limit(limit),
      db
        .select({ id: profiles.id, display_name: profiles.display_name, created_at: profiles.created_at })
        .from(profiles)
        .where(userConds.length ? and(...userConds) : undefined)
        .orderBy(desc(profiles.created_at))
        .limit(limit),
    ]);

    const items: AdminActivityItem[] = [];
    for (const s of storiesRows) {
      if (!s.published_at) continue;
      items.push({ type: "story_published", id: s.id, actorName: s.author.display_name, targetTitle: s.title, timestamp: toISO(s.published_at) });
    }
    for (const c of commentsRows) {
      items.push({ type: "new_comment", id: c.id, actorName: c.user.display_name, targetTitle: c.storyTitle, timestamp: toISO(c.created_at) });
    }
    for (const u of usersRows) {
      items.push({ type: "new_user", id: u.id, actorName: u.display_name, timestamp: toISO(u.created_at) });
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
    const db = getDb();

    const userConds = [];
    if (range?.from) userConds.push(gte(profiles.created_at, new Date(range.from)));
    if (range?.to) userConds.push(lte(profiles.created_at, new Date(range.to)));

    const chapterConds = [isNotNull(chapters.published_at)];
    if (range?.from) chapterConds.push(gte(chapters.published_at, new Date(range.from)));
    if (range?.to) chapterConds.push(lte(chapters.published_at, new Date(range.to)));

    const commentConds = [];
    if (range?.from) commentConds.push(gte(comments.created_at, new Date(range.from)));
    if (range?.to) commentConds.push(lte(comments.created_at, new Date(range.to)));

    const [[{ newUsers }], [{ publishedChapters }], [{ newComments }]] = await Promise.all([
      db.select({ newUsers: count() }).from(profiles).where(userConds.length ? and(...userConds) : undefined),
      db.select({ publishedChapters: count() }).from(chapters).where(and(...chapterConds)),
      db.select({ newComments: count() }).from(comments).where(commentConds.length ? and(...commentConds) : undefined),
    ]);

    return { newUsers, publishedChapters, newComments };
  } catch {
    return { newUsers: 0, publishedChapters: 0, newComments: 0 };
  }
}

export type AdminUserSort = "newest" | "followers" | "stories";

export async function searchUsersAdmin(query?: string, sort: AdminUserSort = "newest") {
  try {
    const db = getDb();
    const q = query?.trim();
    const where = q ? or(ilike(profiles.display_name, `%${q}%`), ilike(profiles.username, `%${q}%`)) : undefined;

    if (sort === "newest") {
      const rows = await db.select().from(profiles).where(where).orderBy(desc(profiles.created_at)).limit(100);
      return rows.map((r) => ({ ...r, created_at: toISO(r.created_at), onboarded_at: r.onboarded_at ? toISO(r.onboarded_at) : null }));
    }

    // Profiles don't carry a denormalized follower/story count to order by
    // in SQL, so popularity sorts rank in JS instead — fetch a generous
    // window of matching profiles first (same "cap, don't paginate" style as
    // the rest of this file), then rank the whole window before slicing to
    // the 100 actually shown, so an older but genuinely popular author isn't
    // hidden behind a newest-first cutoff.
    const list = await db.select().from(profiles).where(where).limit(500);
    if (list.length === 0) return [];

    const ids = list.map((p) => p.id);
    const counts = sort === "followers" ? await getAuthorFollowerCounts(ids) : await getAuthorStoryCounts(ids);

    return list
      .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
      .slice(0, 100)
      .map((r) => ({ ...r, created_at: toISO(r.created_at), onboarded_at: r.onboarded_at ? toISO(r.onboarded_at) : null }));
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
    const db = getDb();
    const rows = await db
      .select({ author_id: stories.author_id })
      .from(stories)
      .where(and(inArray(stories.author_id, userIds), isNull(stories.deleted_at)));
    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.author_id] = (counts[row.author_id] ?? 0) + 1;
    return counts;
  } catch {
    return {};
  }
}

export async function getAuthorFollowerCounts(userIds: string[]): Promise<Record<string, number>> {
  if (userIds.length === 0) return {};
  try {
    const db = getDb();
    const rows = await db.select({ author_id: follows.author_id }).from(follows).where(inArray(follows.author_id, userIds));
    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.author_id] = (counts[row.author_id] ?? 0) + 1;
    return counts;
  } catch {
    return {};
  }
}

export async function getAllAchievements(): Promise<Achievement[]> {
  try {
    const db = getDb();
    const rows = await db.select().from(achievements).orderBy(asc(achievements.title_ru));
    // metric is a plain text column (no DB-level enum), same as it was a
    // plain text column read through Supabase before — the app has always
    // trusted the small, staff-only achievements table to hold one of
    // these four values rather than enforcing it at the schema level.
    return rows as Achievement[];
  } catch {
    return [];
  }
}

// One query for the whole /admin/users list rather than one per row.
export async function getUserAchievementsMap(userIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (userIds.length === 0) return map;
  try {
    const db = getDb();
    const rows = await db
      .select({ user_id: userAchievements.user_id, achievement_id: userAchievements.achievement_id })
      .from(userAchievements)
      .where(inArray(userAchievements.user_id, userIds));
    for (const row of rows) {
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
    const db = getDb();
    const rows = await db.select().from(heroSlides).orderBy(asc(heroSlides.created_at));
    return rows.map((r) => ({ ...r, created_at: toISO(r.created_at) }));
  } catch {
    return [];
  }
}

export async function getAllAnnouncementsAdmin(): Promise<Announcement[]> {
  try {
    const db = getDb();
    const rows = await db.select().from(announcementsTable).orderBy(desc(announcementsTable.created_at));
    return rows.map((r) => ({ ...r, created_at: toISO(r.created_at) }));
  } catch {
    return [];
  }
}

export async function searchStoriesForFeaturedAdmin(query?: string) {
  try {
    const db = getDb();
    const q = query?.trim();
    const where = q
      ? and(eq(stories.status, "published"), ilike(stories.title, `%${q}%`))
      : eq(stories.status, "published");
    const rows = await db
      .select({ id: stories.id, title: stories.title, author: { display_name: profiles.display_name } })
      .from(stories)
      .innerJoin(profiles, eq(stories.author_id, profiles.id))
      .where(where)
      .orderBy(asc(stories.title))
      .limit(100);
    return rows;
  } catch {
    return [];
  }
}

// One query for the whole /admin/featured list rather than one per row.
export async function getFeaturedTiersMap(storyIds: string[]): Promise<Map<string, Set<StoryTopTier>>> {
  const map = new Map<string, Set<StoryTopTier>>();
  if (storyIds.length === 0) return map;
  try {
    const db = getDb();
    const rows = await db
      .select({ story_id: featuredStories.story_id, tier: featuredStories.tier })
      .from(featuredStories)
      .where(inArray(featuredStories.story_id, storyIds));
    for (const row of rows) {
      const set = map.get(row.story_id) ?? new Set<StoryTopTier>();
      set.add(row.tier);
      map.set(row.story_id, set);
    }
    return map;
  } catch {
    return map;
  }
}

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
    const db = getDb();
    let list: (Story & { author: { display_name: string } | null })[] = [];

    const selectStory = () =>
      db
        .select({ story: stories, author: { display_name: profiles.display_name } })
        .from(stories)
        .innerJoin(profiles, eq(stories.author_id, profiles.id));

    // The trash — soft-deleted by their author (deleted_at set, see
    // deleteStory in stories.ts) — is its own tab, kept out of every other
    // tab below rather than mixed into the regular status list.
    if (statusFilter === "deleted") {
      const conds = [isNotNull(stories.deleted_at)];
      if (title) conds.push(ilike(stories.title, `%${title}%`));
      const rows = await selectStory().where(and(...conds)).limit(STORY_FETCH_LIMIT);
      list = rows.map((r) => ({ ...storyRowToStory(r.story), author: r.author }));
    } else if (statusFilter === "pending_review") {
      // A story keeps its own status once published — adding chapters to it
      // afterward never touches stories.status, only the new chapters' own
      // (pending_review by default). Filtering this tab by stories.status
      // alone would silently hide every "add chapters to an already-approved
      // story" submission from the pending queue, so it also pulls in any
      // story that merely *has* a pending chapter, whatever the story's own
      // status is.
      const pendingConds = [eq(stories.status, "pending_review"), isNull(stories.deleted_at)];
      if (title) pendingConds.push(ilike(stories.title, `%${title}%`));
      const [pendingRows, pendingChapterRows] = await Promise.all([
        selectStory().where(and(...pendingConds)),
        db.select({ story_id: chapters.story_id }).from(chapters).where(eq(chapters.status, "pending_review")),
      ]);

      const already = new Set(pendingRows.map((r) => r.story.id));
      const extraIds = [...new Set(pendingChapterRows.map((c) => c.story_id))].filter((id) => !already.has(id));

      let extraRows: typeof pendingRows = [];
      if (extraIds.length) {
        const extraConds = [inArray(stories.id, extraIds), isNull(stories.deleted_at)];
        if (title) extraConds.push(ilike(stories.title, `%${title}%`));
        extraRows = await selectStory().where(and(...extraConds));
      }

      list = [...pendingRows, ...extraRows].map((r) => ({ ...storyRowToStory(r.story), author: r.author }));
    } else {
      const conds = [isNull(stories.deleted_at)];
      if (statusFilter) conds.push(eq(stories.status, statusFilter as Story["status"]));
      if (title) conds.push(ilike(stories.title, `%${title}%`));
      const rows = await selectStory().where(and(...conds)).limit(STORY_FETCH_LIMIT);
      list = rows.map((r) => ({ ...storyRowToStory(r.story), author: r.author }));
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
    const db = getDb();
    const rows = await db.select({ story_id: chapters.story_id }).from(chapters).where(inArray(chapters.story_id, storyIds));
    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.story_id] = (counts[row.story_id] ?? 0) + 1;
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
    const db = getDb();
    const rows = await db
      .select({ story_id: chapters.story_id })
      .from(chapters)
      .where(and(eq(chapters.status, "pending_review"), inArray(chapters.story_id, storyIds)));
    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.story_id] = (counts[row.story_id] ?? 0) + 1;
    return counts;
  } catch {
    return {};
  }
}

// Moderation reads always see every story/chapter regardless of status
// (pending_review, draft after a rejection, etc) — nothing to opt into
// anymore, there's no RLS layer in between. This view is intentionally
// decoupled from the author's own /manage page: admins can read here,
// never edit, and their reads never touch view_count (no
// ChapterReadingRecorder on these routes).

export type StoryForModeration = Story & {
  author: { id: string; username: string; display_name: string } | null;
};

export async function getStoryForModeration(id: string): Promise<StoryForModeration | null> {
  try {
    const db = getDb();
    const [row] = await db
      .select({
        story: stories,
        author: { id: profiles.id, username: profiles.username, display_name: profiles.display_name },
      })
      .from(stories)
      .innerJoin(profiles, eq(stories.author_id, profiles.id))
      .where(eq(stories.id, id))
      .limit(1);
    return row ? { ...storyRowToStory(row.story), author: row.author } : null;
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
    const db = getDb();
    const rows = await db
      .select({
        id: chapters.id,
        story_id: chapters.story_id,
        order_index: chapters.order_index,
        title: chapters.title,
        word_count: chapters.word_count,
        status: chapters.status,
        rejection_reason: chapters.rejection_reason,
        updated_at: chapters.updated_at,
      })
      .from(chapters)
      .where(eq(chapters.story_id, storyId))
      .orderBy(asc(chapters.order_index));
    return rows.map((r) => ({ ...r, updated_at: toISO(r.updated_at) }));
  } catch {
    return [];
  }
}

export async function getChapterForModeration(chapterId: string): Promise<Chapter | null> {
  try {
    const db = getDb();
    const [row] = await db.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
    return row ? chapterRowToChapter(row) : null;
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
    const db = getDb();
    return await db
      .select({ order_index: chapters.order_index, title: chapters.title, content: chapters.content })
      .from(chapters)
      .where(eq(chapters.story_id, storyId))
      .orderBy(asc(chapters.order_index));
  } catch {
    return [];
  }
}

export async function getAllRequestsAdmin(statusFilter?: string) {
  try {
    const db = getDb();
    const where = statusFilter ? eq(requests.status, statusFilter as "open" | "closed") : undefined;
    const rows = await db
      .select({ request: requests, from_user: { display_name: profiles.display_name } })
      .from(requests)
      .innerJoin(profiles, eq(requests.from_user_id, profiles.id))
      .where(where)
      .orderBy(desc(requests.created_at))
      .limit(100);
    return rows.map((r) => ({ ...r.request, created_at: toISO(r.request.created_at), from_user: r.from_user }));
  } catch {
    return [];
  }
}

export async function getAllCollectionsAdmin() {
  try {
    const db = getDb();
    const rows = await db
      .select({ collection: collections, owner: { display_name: profiles.display_name } })
      .from(collections)
      .innerJoin(profiles, eq(collections.owner_id, profiles.id))
      .orderBy(desc(collections.created_at))
      .limit(100);
    return rows.map((r) => ({ ...r.collection, created_at: toISO(r.collection.created_at), owner: r.owner }));
  } catch {
    return [];
  }
}

export async function getCollectionByIdAdmin(id: string) {
  try {
    const db = getDb();
    const [row] = await db.select().from(collections).where(eq(collections.id, id)).limit(1);
    return row ? { ...row, created_at: toISO(row.created_at) } : null;
  } catch {
    return null;
  }
}

export async function getCollectionItemIds(collectionId: string): Promise<string[]> {
  try {
    const db = getDb();
    const rows = await db.select({ story_id: collectionItems.story_id }).from(collectionItems).where(eq(collectionItems.collection_id, collectionId));
    return rows.map((r) => r.story_id);
  } catch {
    return [];
  }
}

export async function getAllStoriesForAdminPicker() {
  try {
    const db = getDb();
    return await db
      .select({ id: stories.id, title: stories.title, author: { display_name: profiles.display_name } })
      .from(stories)
      .innerJoin(profiles, eq(stories.author_id, profiles.id))
      .orderBy(asc(stories.title));
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

// Top-level comments only, paginated — each thread's replies are fetched
// separately (one extra query keyed off the page's parent ids) and nested
// underneath so "reply comes together with the comment it answers" holds
// even though replies themselves aren't paginated independently.
export async function getAllCommentsAdmin(page = 1, pageSize = 24): Promise<{ threads: AdminCommentThread[]; total: number }> {
  try {
    const db = getDb();
    const [{ total }] = await db.select({ total: count() }).from(comments).where(isNull(comments.parent_id));

    const from = (page - 1) * pageSize;
    const selectComment = () =>
      db
        .select({
          id: comments.id,
          parent_id: comments.parent_id,
          text: comments.text,
          like_count: comments.like_count,
          is_spoiler: comments.is_spoiler,
          created_at: comments.created_at,
          user: { display_name: profiles.display_name, username: profiles.username },
          story: { id: stories.id, title: stories.title, slug: stories.slug },
          chapter_id: chapters.id,
          chapter_order_index: chapters.order_index,
          chapter_title: chapters.title,
        })
        .from(comments)
        .innerJoin(profiles, eq(comments.user_id, profiles.id))
        .innerJoin(stories, eq(comments.story_id, stories.id))
        .leftJoin(chapters, eq(comments.chapter_id, chapters.id));

    const topLevel = await selectComment()
      .where(isNull(comments.parent_id))
      .orderBy(desc(comments.created_at))
      .limit(pageSize)
      .offset(from);

    const topIds = topLevel.map((c) => c.id);
    const replies = topIds.length
      ? await selectComment().where(inArray(comments.parent_id, topIds)).orderBy(asc(comments.created_at))
      : [];

    function toRow(c: (typeof topLevel)[number]): AdminCommentRow {
      return {
        id: c.id,
        parent_id: c.parent_id,
        text: c.text,
        like_count: c.like_count,
        is_spoiler: c.is_spoiler,
        created_at: toISO(c.created_at),
        user: c.user,
        story: c.story,
        chapter: c.chapter_id ? { id: c.chapter_id, order_index: c.chapter_order_index!, title: c.chapter_title! } : null,
      };
    }

    const repliesByParent = new Map<string, AdminCommentRow[]>();
    for (const r of replies) {
      const row = toRow(r);
      const arr = repliesByParent.get(row.parent_id as string) ?? [];
      arr.push(row);
      repliesByParent.set(row.parent_id as string, arr);
    }

    const threads = topLevel.map((c) => ({ ...toRow(c), replies: repliesByParent.get(c.id) ?? [] }));

    return { threads, total };
  } catch {
    return { threads: [], total: 0 };
  }
}

export async function getPlatformSettingsAdmin() {
  try {
    const db = getDb();
    const [row] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}
