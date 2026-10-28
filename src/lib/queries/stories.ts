import "server-only";
import { anyTextContains, normalizeSearch } from "@/lib/queries/search-text";
import { unstable_cache } from "next/cache";
import { and, arrayOverlaps, asc, count, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/current-user";
import { logQueryError, withFallback } from "@/lib/queries/query-errors";
import { getDb } from "@/server/db/client";
import {
  bookmarks,
  chapters,
  collectionItems,
  collections,
  customLanguages,
  featuredStories,
  follows,
  heroSlides,
  announcements,
  likes,
  platformSettings,
  profiles,
  readingProgress,
  readingStatuses,
  savedCollections,
  stories,
  storyTags,
  tags,
} from "@/server/db/schema";
import { genreVariants } from "@/lib/genre";
import type { HomeTab } from "@/lib/homeTabs";
import type { Story, Chapter, Collection, Profile, StoryTopTier, HeroSlide, Announcement } from "@/types/database";
import { liveImageUrl } from "@/lib/images";

// Drizzle returns Date objects for timestamp columns; every consumer of
// StoryCard (date formatting in components, etc.) expects the ISO-string
// shape PostgREST always produced — converting here keeps that contract
// identical for every caller regardless of which backend answered it.
export function toStoryCard(
  row: typeof stories.$inferSelect,
  author: { username: string; display_name: string }
): StoryCard {
  return {
    ...row,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    published_at: row.published_at ? row.published_at.toISOString() : null,
    deleted_at: row.deleted_at ? row.deleted_at.toISOString() : null,
    author,
  };
}

function toCollection(row: typeof collections.$inferSelect): Collection {
  return { ...row, created_at: row.created_at.toISOString() };
}

// Every query here returns an empty result instead of throwing if the
// database is unreachable, so pages render their empty states.

export type StoryCard = Story & { author: Pick<Profile, "username" | "display_name"> };

export type Paginated<T> = { items: T[]; total: number };

// Functions below wrapped in unstable_cache are the ones that filter to
// status = 'published' (and visibility/is_private where relevant)
// unconditionally, with no author/staff branch — their result is byte-for-
// byte the same for every viewer (or, for the per-user feeds, keyed by
// userId), so caching them for a short window can't leak anything.
const CACHE_SECONDS = 300;

const PUBLIC_STORY_FILTER = and(eq(stories.status, "published"), eq(stories.visibility, "public"), isNull(stories.deleted_at));
const AUTHOR_COLUMNS = { username: profiles.username, display_name: profiles.display_name };
// Postgres sorts NULLs first under DESC, so a story with no published_at
// floated to the top of "Новые"; nulls last keeps it at the bottom instead.
const NEWEST_FIRST = sql`${stories.published_at} desc nulls last`;

async function queryPublicStories(
  orderBy: ReturnType<typeof desc>,
  limit: number,
  offset: number,
  extraFilter?: ReturnType<typeof and>
): Promise<Paginated<StoryCard>> {
  try {
    const db = getDb();
    const where = extraFilter ? and(PUBLIC_STORY_FILTER, extraFilter) : PUBLIC_STORY_FILTER;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({ story: stories, author: AUTHOR_COLUMNS })
        .from(stories)
        .innerJoin(profiles, eq(stories.author_id, profiles.id))
        .where(where)
        .orderBy(orderBy, desc(stories.id))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(stories).where(where),
    ]);

    return { items: rows.map((r) => toStoryCard(r.story, r.author)), total };
  } catch (err) {
    logQueryError("queryPublicStories", err);
    throw err;
  }
}

export const getPopularStories = withFallback(
  "getPopularStories",
  unstable_cache(
  (limit = 8, offset = 0) => queryPublicStories(desc(stories.like_count), limit, offset),
  ["popular-stories"],
  { revalidate: CACHE_SECONDS, tags: ["stories"] }
  ),
  () => ({ items: [], total: 0 })
);

export const getFinishedStories = withFallback(
  "getFinishedStories",
  unstable_cache(
  (limit = 8, offset = 0) =>
    queryPublicStories(desc(stories.like_count), limit, offset, eq(stories.progress_status, "finished")),
  ["finished-stories"],
  { revalidate: CACHE_SECONDS, tags: ["stories"] }
  ),
  () => ({ items: [], total: 0 })
);

export const getNewestStories = withFallback(
  "getNewestStories",
  unstable_cache(
  (limit = 8, offset = 0) => queryPublicStories(NEWEST_FIRST, limit, offset),
  ["newest-stories"],
  { revalidate: CACHE_SECONDS, tags: ["stories"] }
  ),
  () => ({ items: [], total: 0 })
);

// "Подписки" home tab. unstable_cache'd per-viewer — userId is part of the
// function's arguments, which Next.js folds into the cache key alongside
// the keyParts below, so each user gets their own cache entry (no leaking
// one user's feed to another).
export const getFollowingStories = withFallback(
  "getFollowingStories",
  unstable_cache(
  async (userId: string, limit = 8, offset = 0): Promise<Paginated<StoryCard>> => {
    try {
      const db = getDb();
      const followedRows = await db
        .select({ author_id: follows.author_id })
        .from(follows)
        .where(eq(follows.follower_id, userId));
      const authorIds = followedRows.map((f) => f.author_id);
      if (authorIds.length === 0) return { items: [], total: 0 };
      return queryPublicStories(NEWEST_FIRST, limit, offset, and(inArray(stories.author_id, authorIds)));
    } catch (err) {
      logQueryError("getFollowingStories", err);
      throw err;
    }
  },
  ["following-stories"],
  { revalidate: CACHE_SECONDS, tags: ["stories"] }
  ),
  () => ({ items: [], total: 0 })
);

// "Для вас" home tab — same per-viewer caching as getFollowingStories
// above. Preference signal is the union of the genres picked at onboarding
// (profiles.interests) and the genres of everything the user has liked so
// far, each expanded to every locale's label via genreVariants() (both
// interests and stories.genres are stored in whatever locale was active
// when they were picked/created — see src/lib/genre.ts). A brand new
// account has neither yet, so this naturally falls back to the same
// popular feed as everyone else until they pick interests or like
// something.
export const getForYouStories = withFallback(
  "getForYouStories",
  unstable_cache(
  async (userId: string, limit = 8, offset = 0): Promise<Paginated<StoryCard>> => {
    try {
      const db = getDb();
      const [[profile], likedRows] = await Promise.all([
        db.select({ interests: profiles.interests }).from(profiles).where(eq(profiles.id, userId)).limit(1),
        db
          .select({ target_id: likes.target_id })
          .from(likes)
          .where(and(eq(likes.user_id, userId), eq(likes.target_type, "story"))),
      ]);

      const likedStoryIds = likedRows.map((r) => r.target_id);
      let likedGenres: string[] = [];
      if (likedStoryIds.length > 0) {
        const likedStories = await db.select({ genres: stories.genres }).from(stories).where(inArray(stories.id, likedStoryIds));
        likedGenres = likedStories.flatMap((s) => s.genres ?? []);
      }

      const rawGenres = [...new Set([...(profile?.interests ?? []), ...likedGenres])];
      const preferredGenres = [...new Set(rawGenres.flatMap((g) => genreVariants(g)))];

      if (preferredGenres.length === 0) return getPopularStories(limit, offset);

      return queryPublicStories(desc(stories.like_count), limit, offset, and(arrayOverlaps(stories.genres, preferredGenres)));
    } catch (err) {
      logQueryError("getForYouStories", err);
      throw err;
    }
  },
  ["for-you-stories"],
  { revalidate: CACHE_SECONDS, tags: ["stories"] }
  ),
  () => ({ items: [], total: 0 })
);

// Same tab -> query dispatch the home page's feed section uses, shared with
// the /all "все истории" page so both list identical content for a tab —
// including the same not-logged-in fallback to popular for forYou/following.
export async function getFeedForTab(
  tab: HomeTab,
  userId: string | undefined,
  limit: number,
  offset: number
): Promise<Paginated<StoryCard>> {
  if (tab === "new") return getNewestStories(limit, offset);
  if (tab === "following" && userId) return getFollowingStories(userId, limit, offset);
  if (tab === "forYou" && userId) return getForYouStories(userId, limit, offset);
  return getPopularStories(limit, offset);
}

export type CollectionCardData = Collection & {
  owner: Pick<Profile, "display_name"> | null;
  coverUrls: string[];
  storyCount: number;
};

type CollectionWithOwner = Collection & { owner: Pick<Profile, "display_name"> | null };

const COLLECTION_WITH_OWNER = { collection: collections, owner: { display_name: profiles.display_name } };

function toCollectionWithOwner(row: {
  collection: typeof collections.$inferSelect;
  owner: { display_name: string } | null;
}): CollectionWithOwner {
  return { ...toCollection(row.collection), owner: row.owner };
}

// Cover art for a collection card is a collage of its first 3 stories'
// covers — there's no separate uploaded image, this is derived from
// collection_items so it always reflects what's actually inside.
export async function attachCollectionCovers(list: CollectionWithOwner[]): Promise<CollectionCardData[]> {
  if (list.length === 0) return [];
  const db = getDb();
  const items = await db
    .select({ collection_id: collectionItems.collection_id, cover_url: stories.cover_url })
    .from(collectionItems)
    .innerJoin(stories, eq(collectionItems.story_id, stories.id))
    .where(
      and(
        inArray(
          collectionItems.collection_id,
          list.map((c) => c.id)
        ),
        PUBLIC_STORY_FILTER,
        isNull(stories.deleted_at)
      )
    )
    .orderBy(asc(collectionItems.position));
  const covers = new Map<string, string[]>();
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.collection_id, (counts.get(item.collection_id) ?? 0) + 1);
    const cover = liveImageUrl(item.cover_url);
    if (!cover) continue;
    const arr = covers.get(item.collection_id) ?? [];
    if (arr.length < 3) arr.push(cover);
    covers.set(item.collection_id, arr);
  }
  return list.map((c) => ({
    ...c,
    coverUrls: covers.get(c.id) ?? [],
    storyCount: counts.get(c.id) ?? 0,
  }));
}

export const getFeaturedCollections = withFallback(
  "getFeaturedCollections",
  unstable_cache(
  async (limit = 3, offset = 0): Promise<Paginated<CollectionCardData>> => {
    try {
      const db = getDb();
      const where = and(eq(collections.is_featured, true), eq(collections.is_private, false));
      const [rows, [{ total }]] = await Promise.all([
        db
          .select(COLLECTION_WITH_OWNER)
          .from(collections)
          .leftJoin(profiles, eq(collections.owner_id, profiles.id))
          .where(where)
          .orderBy(desc(collections.created_at))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(collections).where(where),
      ]);
      const items = await attachCollectionCovers(rows.map(toCollectionWithOwner));
      return { items, total };
    } catch (err) {
      logQueryError("getFeaturedCollections", err);
      throw err;
    }
  },
  ["featured-collections"],
  { revalidate: CACHE_SECONDS, tags: ["collections"] }
  ),
  () => ({ items: [], total: 0 })
);

// Hero-banner carousel slides, managed from /admin/banner — ordered by
// created_at, so slide 1 is whichever row was created earliest.
export const getHeroSlides = withFallback(
  "getHeroSlides",
  unstable_cache(
  async (): Promise<HeroSlide[]> => {
    try {
      const db = getDb();
      const rows = await db.select().from(heroSlides).orderBy(asc(heroSlides.created_at));
      return rows.map((r) => ({
        ...r,
        image_url: liveImageUrl(r.image_url),
        image_url_mobile: liveImageUrl(r.image_url_mobile),
        created_at: r.created_at.toISOString(),
      }));
    } catch (err) {
      logQueryError("getHeroSlides", err);
      throw err;
    }
  },
  ["hero-slides"],
  { revalidate: CACHE_SECONDS, tags: ["hero-slides"] }
  ),
  () => ([])
);

// Small announcement cards next to the hero, managed from
// /admin/announcements — newest first (unlike hero slides, recency is the
// point). AnnouncementBoard paginates these 2 at a time as a vertical
// carousel, so the caller can (and does) fetch more than just 2.
export const getAnnouncements = withFallback(
  "getAnnouncements",
  unstable_cache(
  async (limit = 12): Promise<Announcement[]> => {
    try {
      const db = getDb();
      const rows = await db.select().from(announcements).orderBy(desc(announcements.created_at)).limit(limit);
      return rows.map((r) => ({ ...r, image_url: liveImageUrl(r.image_url), created_at: r.created_at.toISOString() }));
    } catch (err) {
      logQueryError("getAnnouncements", err);
      throw err;
    }
  },
  ["announcements"],
  { revalidate: CACHE_SECONDS, tags: ["announcements"] }
  ),
  () => ([])
);

// Staff-pinned stories for the homepage's Топ дня/недели/месяца section
// (featured_stories, /admin/featured) — ordered "first pinned, shown
// first", not by recency.
export const getTopStories = withFallback(
  "getTopStories",
  unstable_cache(
  async (tier: StoryTopTier, limit = 8): Promise<StoryCard[]> => {
    try {
      const db = getDb();
      const pins = await db
        .select({ story_id: featuredStories.story_id })
        .from(featuredStories)
        .where(eq(featuredStories.tier, tier))
        .orderBy(asc(featuredStories.featured_at))
        .limit(limit);
      const ids = pins.map((p) => p.story_id);
      if (ids.length === 0) return [];

      const rows = await db
        .select({ story: stories, author: AUTHOR_COLUMNS })
        .from(stories)
        .innerJoin(profiles, eq(stories.author_id, profiles.id))
        .where(and(inArray(stories.id, ids), PUBLIC_STORY_FILTER));
      const byId = new Map(rows.map((r) => [r.story.id, toStoryCard(r.story, r.author)]));
      return ids.map((id) => byId.get(id)).filter((s): s is StoryCard => Boolean(s));
    } catch (err) {
      logQueryError("getTopStories", err);
      throw err;
    }
  },
  ["top-stories"],
  { revalidate: CACHE_SECONDS, tags: ["stories"] }
  ),
  () => ([])
);

// Collections that include at least one of this author's published stories —
// "recommended" in the sense of "readers of this author might like these",
// not a staff curation.
export async function getCollectionsFeaturingAuthor(authorId: string, limit = 6): Promise<CollectionCardData[]> {
  try {
    const db = getDb();
    const items = await db
      .selectDistinct({ collection_id: collectionItems.collection_id })
      .from(collectionItems)
      .innerJoin(stories, eq(collectionItems.story_id, stories.id))
      .where(and(eq(stories.author_id, authorId), eq(stories.status, "published")));
    const collectionIds = items.map((i) => i.collection_id);
    if (collectionIds.length === 0) return [];

    const rows = await db
      .select(COLLECTION_WITH_OWNER)
      .from(collections)
      .leftJoin(profiles, eq(collections.owner_id, profiles.id))
      .where(and(inArray(collections.id, collectionIds), eq(collections.is_private, false)))
      .orderBy(desc(collections.created_at))
      .limit(limit);
    return attachCollectionCovers(rows.map(toCollectionWithOwner));
  } catch (err) {
    logQueryError("getCollectionsFeaturingAuthor", err);
    return [];
  }
}

export type WeeklyStoryGroup = {
  // Full StoryCard shape (not just id/title/slug/cover_url) — the home
  // page renders these with the same <StoryCard> component as everywhere
  // else, just with its ribbon overridden to a chapter-count label.
  story: StoryCard;
  chapterCount: number;
  // Only set when chapterCount === 1 — lets the card link straight to that
  // one chapter instead of the story page, same as before this was grouped.
  singleChapter: { id: string; title: string; order_index: number } | null;
};

const RECENT_DAYS = 7;

// One row per story (not per chapter) — the grouping/windowing/pagination
// happens in SQL so total already matches what gets rendered (one card per
// story). Same query the recent_chapter_stories() Postgres function (migration
// 0036) ran, inlined here so it doesn't depend on that function existing.
export const getRecentPublishedChapters = withFallback(
  "getRecentPublishedChapters",
  unstable_cache(
  async (limit = 3, offset = 0): Promise<Paginated<WeeklyStoryGroup>> => {
    try {
      const db = getDb();
      const result = await db.execute<{ story_id: string; chapter_count: number; total_count: number }>(sql`
        select c.story_id,
               count(*)::int as chapter_count,
               (count(*) over ())::int as total_count
        from chapters c
        join stories s on s.id = c.story_id
        where c.status = 'published'
          and c.published_at >= now() - (${RECENT_DAYS} || ' days')::interval
          and s.status = 'published'
          and s.visibility = 'public'
          and s.deleted_at is null
        group by c.story_id
        order by max(c.published_at) desc
        limit ${limit} offset ${offset}
      `);
      const groups = result.rows;
      if (groups.length === 0) return { items: [], total: 0 };

      const total = Number(groups[0].total_count ?? 0);
      const storyIds = groups.map((g) => g.story_id);
      const singleStoryIds = groups.filter((g) => Number(g.chapter_count) === 1).map((g) => g.story_id);
      const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);

      const [storyRows, singleChapters] = await Promise.all([
        db
          .select({ story: stories, author: AUTHOR_COLUMNS })
          .from(stories)
          .innerJoin(profiles, eq(stories.author_id, profiles.id))
          .where(inArray(stories.id, storyIds)),
        singleStoryIds.length === 0
          ? Promise.resolve([])
          : db
              .select({ id: chapters.id, story_id: chapters.story_id, title: chapters.title, order_index: chapters.order_index })
              .from(chapters)
              .where(
                and(
                  inArray(chapters.story_id, singleStoryIds),
                  eq(chapters.status, "published"),
                  // Matches the window above — without it a story that also
                  // has older published chapters could pick up one of those
                  // instead of its one genuinely recent chapter.
                  gte(chapters.published_at, since)
                )
              ),
      ]);
      const storyById = new Map(storyRows.map((r) => [r.story.id, toStoryCard(r.story, r.author)]));
      const singleChapterByStory = new Map(
        singleChapters.map((c) => [c.story_id, { id: c.id, title: c.title, order_index: c.order_index }])
      );

      const items: WeeklyStoryGroup[] = [];
      for (const g of groups) {
        const story = storyById.get(g.story_id);
        if (!story) continue;
        items.push({
          story,
          chapterCount: Number(g.chapter_count),
          singleChapter: singleChapterByStory.get(g.story_id) ?? null,
        });
      }

      return { items, total };
    } catch (err) {
      logQueryError("getRecentPublishedChapters", err);
      throw err;
    }
  },
  ["recent-published-chapters"],
  { revalidate: CACHE_SECONDS, tags: ["stories"] }
  ),
  () => ({ items: [], total: 0 })
);

export type StoryDetail = Story & {
  author: Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;
};

// Treats a soft-deleted story as not-found for everyone, including its own
// author — this is the single choke point both the public story page and
// the author's own /manage page read through, so it's what actually keeps a
// deleted story out of the author's hands until staff restores it.
export async function getStoryBySlug(slug: string): Promise<StoryDetail | null> {
  try {
    const db = getDb();
    const [row] = await db
      .select({
        story: stories,
        author: {
          id: profiles.id,
          username: profiles.username,
          display_name: profiles.display_name,
          avatar_url: profiles.avatar_url,
        },
      })
      .from(stories)
      .innerJoin(profiles, eq(stories.author_id, profiles.id))
      .where(eq(stories.slug, slug))
      .limit(1);
    if (!row || row.story.deleted_at) return null;
    // A non-published story (or one still marked as a private draft) stays
    // off-limits to anyone but the author/staff — same rule as
    // isStoryPubliclyVisible in server/authz/policy.ts.
    if (row.story.status !== "published" || row.story.visibility === "draft") {
      const viewer = await getCurrentUser();
      const isOwner = viewer?.id === row.story.author_id;
      const isStaff = viewer?.profile?.role === "admin" || viewer?.profile?.role === "moderator";
      if (!isOwner && !isStaff) return null;
    }
    return {
      ...row.story,
      created_at: row.story.created_at.toISOString(),
      updated_at: row.story.updated_at.toISOString(),
      published_at: row.story.published_at ? row.story.published_at.toISOString() : null,
      // Already guarded not-truthy above (deleted stories return null before
      // this point) — TS narrows it to `null` here, so no .toISOString() call.
      deleted_at: null,
      author: row.author,
    };
  } catch (err) {
    logQueryError("getStoryBySlug", err);
    return null;
  }
}

function toChapter(row: typeof chapters.$inferSelect): Chapter {
  return {
    ...row,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    published_at: row.published_at ? row.published_at.toISOString() : null,
  };
}

export async function getChaptersForStory(
  storyId: string,
  includeDrafts = false
): Promise<Chapter[]> {
  try {
    const db = getDb();
    const where = includeDrafts
      ? eq(chapters.story_id, storyId)
      : and(eq(chapters.story_id, storyId), eq(chapters.status, "published"));
    const rows = await db.select().from(chapters).where(where).orderBy(asc(chapters.order_index));
    return rows.map(toChapter);
  } catch (err) {
    logQueryError("getChaptersForStory", err);
    return [];
  }
}

export async function getChapter(storyId: string, orderIndex: number): Promise<Chapter | null> {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(chapters)
      .where(
        and(eq(chapters.story_id, storyId), eq(chapters.order_index, orderIndex), eq(chapters.status, "published"))
      )
      .limit(1);
    return row ? toChapter(row) : null;
  } catch (err) {
    logQueryError("getChapter", err);
    return null;
  }
}

export type ContinueReadingItem = {
  story_id: string;
  percent: number;
  updated_at: string;
  story: { id: string; title: string; slug: string; cover_url: string | null };
};

// A deleted or unpublished story's progress row is stale — nothing to
// resume — so it's dropped rather than shown as a dead link. Once the
// reader explicitly marks a story's reading status (want to read/read/
// dropped), it moves out of "Читаю" into that status's own tab instead of
// lingering in both.
// The percent is recomputed here from the chapter reached and the story's
// current number of published chapters (same formula as saveReadingProgress)
// — the stored value went stale when the author added chapters later, so a
// finished story kept showing 100%.
export async function getContinueReading(userId: string, limit = 3): Promise<ContinueReadingItem[]> {
  try {
    const db = getDb();
    const [rows, statusRows] = await Promise.all([
      db
        .select({
          story_id: readingProgress.story_id,
          percent: readingProgress.percent,
          order_index: chapters.order_index,
          published_chapters: sql<number>`(select count(*)::int from chapters c where c.story_id = ${stories.id} and c.status = 'published')`,
          updated_at: readingProgress.updated_at,
          story: { id: stories.id, title: stories.title, slug: stories.slug, cover_url: stories.cover_url },
        })
        .from(readingProgress)
        .innerJoin(stories, eq(readingProgress.story_id, stories.id))
        .leftJoin(chapters, eq(readingProgress.chapter_id, chapters.id))
        .where(
          and(eq(readingProgress.user_id, userId), isNull(stories.deleted_at), eq(stories.status, "published"))
        )
        .orderBy(desc(readingProgress.updated_at))
        .limit(limit * 3),
      db.select({ story_id: readingStatuses.story_id }).from(readingStatuses).where(eq(readingStatuses.user_id, userId)),
    ]);
    const statusedStoryIds = new Set(statusRows.map((r) => r.story_id));
    return rows
      .filter((row) => !statusedStoryIds.has(row.story_id))
      .slice(0, limit)
      .map(({ order_index, published_chapters, ...row }) => ({
        ...row,
        percent:
          order_index !== null && published_chapters > 0
            ? Math.min(100, Math.round((order_index / published_chapters) * 100))
            : Number(row.percent),
        updated_at: row.updated_at.toISOString(),
      }));
  } catch (err) {
    logQueryError("getContinueReading", err);
    return [];
  }
}

export interface SearchFilters {
  q?: string;
  language?: string;
  genre?: string;
  progressStatus?: string;
  age?: string;
  relationship?: string;
  style?: string;
  warnings?: string[];
  // Free, user-created tags (category "style" in the tags table), matched by
  // label — all must be present (AND), like warnings.
  tags?: string[];
  sort?: "popular" | "newest" | "views";
}

async function storyIdsForTag(category: "style" | "warning", label: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ story_id: storyTags.story_id })
    .from(storyTags)
    .innerJoin(tags, eq(storyTags.tag_id, tags.id))
    .where(and(eq(tags.category, category), eq(tags.label_ru, label)));
  return rows.map((r) => r.story_id);
}

// A free tag filter matches by the stored label in either locale column
// (user tags are saved with label_ru = label_uz = the typed text), whatever
// category it was filed under.
async function storyIdsForTagLabel(label: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ story_id: storyTags.story_id })
    .from(storyTags)
    .innerJoin(tags, eq(storyTags.tag_id, tags.id))
    .where(or(eq(tags.label_ru, label), eq(tags.label_uz, label)));
  return rows.map((r) => r.story_id);
}

// LIKE wildcards in the user's own search text are matched literally.
export const searchStories = withFallback(
  "searchStories",
  unstable_cache(
  async (filters: SearchFilters): Promise<StoryCard[]> => {
    try {
      const db = getDb();
      const conditions = [PUBLIC_STORY_FILTER];

      // Title, description, author (name / @username) or a tag — what the
      // search box's placeholder promises; apostrophe- and case-insensitive.
      const q = filters.q ? normalizeSearch(filters.q) : "";
      if (q) {
        conditions.push(
          or(
            anyTextContains([stories.title, stories.description, profiles.display_name, profiles.username], q),
            sql`${stories.id} in (select ${storyTags.story_id} from ${storyTags} inner join ${tags} on ${tags.id} = ${storyTags.tag_id} where ${anyTextContains([tags.label_ru, tags.label_uz], q)})`
          )
        );
      }
      if (filters.language) conditions.push(eq(stories.language, filters.language));
      if (filters.genre) conditions.push(arrayOverlaps(stories.genres, genreVariants(filters.genre)));
      if (filters.progressStatus)
        conditions.push(eq(stories.progress_status, filters.progressStatus as typeof stories.$inferSelect.progress_status));
      if (filters.age) conditions.push(eq(stories.age_rating, filters.age as typeof stories.$inferSelect.age_rating));
      if (filters.relationship) conditions.push(eq(stories.relationship_type, filters.relationship));

      if (filters.style) {
        const ids = await storyIdsForTag("style", filters.style);
        if (ids.length === 0) return [];
        conditions.push(inArray(stories.id, ids));
      }

      for (const warning of filters.warnings ?? []) {
        const ids = await storyIdsForTag("warning", warning);
        if (ids.length === 0) return [];
        conditions.push(inArray(stories.id, ids));
      }

      for (const tag of filters.tags ?? []) {
        const ids = await storyIdsForTagLabel(tag);
        if (ids.length === 0) return [];
        conditions.push(inArray(stories.id, ids));
      }

      const orderBy =
        filters.sort === "newest"
          ? NEWEST_FIRST
          : filters.sort === "views"
            ? desc(stories.view_count)
            : desc(stories.like_count);

      const rows = await db
        .select({ story: stories, author: AUTHOR_COLUMNS })
        .from(stories)
        .innerJoin(profiles, eq(stories.author_id, profiles.id))
        .where(and(...conditions))
        .orderBy(orderBy, desc(stories.id))
        .limit(40);
      const results = rows.map((r) => toStoryCard(r.story, r.author));
      if (results.length === 0) return results;

      // Staff-pinned stories (any tier — featured_stories, /admin/featured)
      // that appear in the results move to the front, earliest-pinned first;
      // everything else keeps its existing relative order (stable sort).
      const pins = await db
        .select({ story_id: featuredStories.story_id, featured_at: featuredStories.featured_at })
        .from(featuredStories);
      if (pins.length === 0) return results;
      const ranks = new Map<string, number>();
      for (const pin of pins) {
        const ts = pin.featured_at.getTime();
        const existing = ranks.get(pin.story_id);
        if (existing === undefined || ts < existing) ranks.set(pin.story_id, ts);
      }
      if (!results.some((s) => ranks.has(s.id))) return results;

      return [...results].sort((a, b) => {
        const ra = ranks.get(a.id);
        const rb = ranks.get(b.id);
        if (ra !== undefined && rb !== undefined) return ra - rb;
        if (ra !== undefined) return -1;
        if (rb !== undefined) return 1;
        return 0;
      });
    } catch (err) {
      logQueryError("searchStories", err);
      throw err;
    }
  },
  ["search-stories"],
  { revalidate: CACHE_SECONDS, tags: ["stories"] }
  ),
  () => ([])
);

// A bookmark or reading status outlives the story's visibility — once a story
// is hidden, sent back to drafts or moved to the trash it must drop out of
// other readers' libraries too (its card would otherwise still show the
// title, cover and description). The viewer's own stories stay listed.
function visibleInLibrary(userId: string) {
  return and(
    isNull(stories.deleted_at),
    or(
      and(eq(stories.status, "published"), ne(stories.visibility, "draft")),
      eq(stories.author_id, userId)
    )
  );
}

export async function getBookmarkedStories(userId: string): Promise<StoryCard[]> {
  try {
    const db = getDb();
    const rows = await db
      .select({ story: stories, author: AUTHOR_COLUMNS })
      .from(bookmarks)
      .innerJoin(stories, eq(bookmarks.story_id, stories.id))
      .innerJoin(profiles, eq(stories.author_id, profiles.id))
      .where(and(eq(bookmarks.user_id, userId), visibleInLibrary(userId)))
      .orderBy(desc(bookmarks.created_at));
    return rows.map((r) => toStoryCard(r.story, r.author));
  } catch (err) {
    logQueryError("getBookmarkedStories", err);
    return [];
  }
}

export async function getMyCollections(userId: string): Promise<CollectionCardData[]> {
  try {
    const db = getDb();
    const rows = await db
      .select(COLLECTION_WITH_OWNER)
      .from(collections)
      .leftJoin(profiles, eq(collections.owner_id, profiles.id))
      .where(eq(collections.owner_id, userId))
      .orderBy(desc(collections.created_at));
    return attachCollectionCovers(rows.map(toCollectionWithOwner));
  } catch (err) {
    logQueryError("getMyCollections", err);
    return [];
  }
}

export type CollectionPickerItem = { id: string; title: string; hasStory: boolean };

// The list an "add to collection" dropdown needs: every collection the
// viewer owns, flagged with whether this particular story is already in it.
export async function getMyCollectionsWithStory(userId: string, storyId: string): Promise<CollectionPickerItem[]> {
  try {
    const db = getDb();
    const [owned, items] = await Promise.all([
      db
        .select({ id: collections.id, title: collections.title })
        .from(collections)
        .where(eq(collections.owner_id, userId))
        .orderBy(desc(collections.created_at)),
      db
        .select({ collection_id: collectionItems.collection_id })
        .from(collectionItems)
        .where(eq(collectionItems.story_id, storyId)),
    ]);
    const inCollectionIds = new Set(items.map((i) => i.collection_id));
    return owned.map((c) => ({ id: c.id, title: c.title, hasStory: inCollectionIds.has(c.id) }));
  } catch (err) {
    logQueryError("getMyCollectionsWithStory", err);
    return [];
  }
}

export async function getStoriesByReadingStatus(userId: string, status: string): Promise<StoryCard[]> {
  try {
    const db = getDb();
    const rows = await db
      .select({ story: stories, author: AUTHOR_COLUMNS })
      .from(readingStatuses)
      .innerJoin(stories, eq(readingStatuses.story_id, stories.id))
      .innerJoin(profiles, eq(stories.author_id, profiles.id))
      .where(
        and(
          eq(readingStatuses.user_id, userId),
          eq(readingStatuses.status, status as "want_to_read" | "read" | "dropped"),
          visibleInLibrary(userId)
        )
      )
      .orderBy(desc(readingStatuses.updated_at));
    return rows.map((r) => toStoryCard(r.story, r.author));
  } catch (err) {
    logQueryError("getStoriesByReadingStatus", err);
    return [];
  }
}

// includeDrafts=true is what powers the author's own "cabinet" listing (own
// profile page, the request-board story picker) — a soft-deleted story is
// still author_id-owned and status='draft', so unlike every status='published'
// filtered query elsewhere, this one needs an explicit deleted_at check to
// actually keep it out of the author's hands.
export async function getAuthorStories(authorId: string, includeDrafts: boolean): Promise<StoryCard[]> {
  try {
    const db = getDb();
    const base = and(eq(stories.author_id, authorId), isNull(stories.deleted_at));
    const rows = await db
      .select({ story: stories, author: AUTHOR_COLUMNS })
      .from(stories)
      .innerJoin(profiles, eq(stories.author_id, profiles.id))
      .where(includeDrafts ? base : and(base, PUBLIC_STORY_FILTER))
      .orderBy(desc(stories.created_at));
    return rows.map((r) => toStoryCard(r.story, r.author));
  } catch (err) {
    logQueryError("getAuthorStories", err);
    return [];
  }
}

export const getPublicCollections = withFallback(
  "getPublicCollections",
  unstable_cache(
  async (ownerType?: string | string[]): Promise<CollectionCardData[]> => {
    try {
      const db = getDb();
      type OwnerType = typeof collections.$inferSelect.owner_type;
      const ownerFilter = Array.isArray(ownerType)
        ? inArray(collections.owner_type, ownerType as OwnerType[])
        : ownerType
          ? eq(collections.owner_type, ownerType as OwnerType)
          : undefined;
      const rows = await db
        .select(COLLECTION_WITH_OWNER)
        .from(collections)
        .leftJoin(profiles, eq(collections.owner_id, profiles.id))
        .where(and(eq(collections.is_private, false), ownerFilter))
        .orderBy(desc(collections.is_featured), desc(collections.created_at));
      return attachCollectionCovers(rows.map(toCollectionWithOwner));
    } catch (err) {
      logQueryError("getPublicCollections", err);
      throw err;
    }
  },
  ["public-collections"],
  { revalidate: CACHE_SECONDS, tags: ["collections"] }
  ),
  () => ([])
);

// A saved collection its owner has since made private disappears from
// everyone else's saved list — same thing RLS used to do.
export async function getSavedCollections(userId: string): Promise<CollectionCardData[]> {
  try {
    const db = getDb();
    const rows = await db
      .select(COLLECTION_WITH_OWNER)
      .from(savedCollections)
      .innerJoin(collections, eq(savedCollections.collection_id, collections.id))
      .leftJoin(profiles, eq(collections.owner_id, profiles.id))
      .where(eq(savedCollections.user_id, userId))
      .orderBy(desc(savedCollections.created_at));
    const visible = rows.filter((r) => !r.collection.is_private || r.collection.owner_id === userId);
    return attachCollectionCovers(visible.map(toCollectionWithOwner));
  } catch (err) {
    logQueryError("getSavedCollections", err);
    return [];
  }
}

export async function isCollectionSaved(userId: string | undefined, collectionId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const db = getDb();
    const [row] = await db
      .select({ collection_id: savedCollections.collection_id })
      .from(savedCollections)
      .where(and(eq(savedCollections.user_id, userId), eq(savedCollections.collection_id, collectionId)))
      .limit(1);
    return Boolean(row);
  } catch (err) {
    logQueryError("isCollectionSaved", err);
    return false;
  }
}

// A private collection is only visible to its owner and staff — this used
// to be enforced by RLS, so it's an explicit check now.
export async function getCollectionWithStories(id: string) {
  try {
    const db = getDb();
    const [row] = await db.select().from(collections).where(eq(collections.id, id)).limit(1);
    if (!row) return null;
    if (row.is_private) {
      const viewer = await getCurrentUser();
      const isOwner = viewer?.id === row.owner_id;
      const isStaff = viewer?.profile?.role === "admin" || viewer?.profile?.role === "moderator";
      if (!isOwner && !isStaff) return null;
    }
    const items = await db
      .select({ story: stories, author: AUTHOR_COLUMNS })
      .from(collectionItems)
      .innerJoin(stories, eq(collectionItems.story_id, stories.id))
      .innerJoin(profiles, eq(stories.author_id, profiles.id))
      // Only stories that are actually public — a collection must not expose
      // the title/cover of a draft, hidden or deleted story.
      .where(and(eq(collectionItems.collection_id, id), PUBLIC_STORY_FILTER, isNull(stories.deleted_at)))
      .orderBy(asc(collectionItems.position));
    return { collection: toCollection(row), stories: items.map((i) => toStoryCard(i.story, i.author)) };
  } catch (err) {
    logQueryError("getCollectionWithStories", err);
    return null;
  }
}

// Existing tag labels for the "type or pick" tag adder on create/edit-story
// forms — genre/age_rating/relationship-type are handled by their own
// dedicated single-select pickers, so this only offers warning/style tags
// plus whatever authors have already typed in.
export const getAllTags = withFallback(
  "getAllTags",
  unstable_cache(
  async (): Promise<string[]> => {
    try {
      const db = getDb();
      const rows = await db
        .select({ label_ru: tags.label_ru })
        .from(tags)
        .where(inArray(tags.category, ["warning", "style"]))
        .orderBy(asc(tags.label_ru));
      return Array.from(new Set(rows.map((t) => t.label_ru)));
    } catch (err) {
      logQueryError("getAllTags", err);
      throw err;
    }
  },
  ["all-tags"],
  { revalidate: CACHE_SECONDS, tags: ["tags"] }
  ),
  () => ([])
);

// Language labels authors have typed in that aren't "ru"/"uz" — offered as
// extra chips next to Русский/Ўзбекча on the create form and as extra
// filters on /search, alongside whatever this specific author just typed.
export const getCustomLanguages = withFallback(
  "getCustomLanguages",
  unstable_cache(
  async (): Promise<string[]> => {
    try {
      const db = getDb();
      const rows = await db.select({ label: customLanguages.label }).from(customLanguages).orderBy(asc(customLanguages.label));
      return rows.map((l) => l.label);
    } catch (err) {
      logQueryError("getCustomLanguages", err);
      throw err;
    }
  },
  ["custom-languages"],
  { revalidate: CACHE_SECONDS, tags: ["custom-languages"] }
  ),
  () => ([])
);

// Every genre actually in use across public stories — including ones authors
// typed themselves (stored straight into stories.genres, never added to the
// fixed dictionary list). Deduplicated case-insensitively (the first spelling
// seen wins), so "Романтика" and "романтика" collapse to one chip.
export const getAllGenres = withFallback(
  "getAllGenres",
  unstable_cache(
  async (): Promise<string[]> => {
    try {
      const db = getDb();
      const rows = await db.select({ genres: stories.genres }).from(stories).where(PUBLIC_STORY_FILTER);
      const seen = new Map<string, string>();
      for (const row of rows) {
        for (const raw of row.genres ?? []) {
          const value = raw.trim();
          const key = value.toLowerCase();
          if (value && !seen.has(key)) seen.set(key, value);
        }
      }
      return [...seen.values()].sort((a, b) => a.localeCompare(b));
    } catch (err) {
      logQueryError("getAllGenres", err);
      throw err;
    }
  },
  ["all-genres"],
  { revalidate: CACHE_SECONDS, tags: ["stories"] }
  ),
  () => ([])
);

export async function getTagsForStory(storyId: string): Promise<string[]> {
  try {
    const db = getDb();
    const rows = await db
      .select({ label_ru: tags.label_ru })
      .from(storyTags)
      .innerJoin(tags, eq(storyTags.tag_id, tags.id))
      .where(eq(storyTags.story_id, storyId));
    return rows.map((r) => r.label_ru);
  } catch (err) {
    logQueryError("getTagsForStory", err);
    return [];
  }
}

export const getGuestFreeChapterCount = withFallback(
  "getGuestFreeChapterCount",
  unstable_cache(
  async (): Promise<number> => {
    try {
      const db = getDb();
      const [row] = await db
        .select({ guest_free_chapters: platformSettings.guest_free_chapters })
        .from(platformSettings)
        .where(eq(platformSettings.id, 1))
        .limit(1);
      return row?.guest_free_chapters ?? 1;
    } catch (err) {
      logQueryError("getGuestFreeChapterCount", err);
      throw err;
    }
  },
  ["guest-free-chapter-count"],
  { revalidate: CACHE_SECONDS, tags: ["settings"] }
  ),
  () => (1)
);
