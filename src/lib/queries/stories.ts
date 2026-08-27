import "server-only";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { Story, Chapter, Collection, Profile, StoryTopTier, HeroSlide } from "@/types/database";

// Every query here tolerates an unreachable Supabase project (placeholder
// .env.local before a real project is wired up) by returning an empty
// result instead of throwing, so pages render their empty states.

export type StoryCard = Story & { author: Pick<Profile, "username" | "display_name"> };

export type Paginated<T> = { items: T[]; total: number };

// Functions below wrapped in unstable_cache are the ones that filter to
// status = 'published' (and visibility/is_private where relevant)
// unconditionally, with no author/staff branch — their result is byte-for-
// byte the same for every viewer, so caching them for a short window can't
// leak anything RLS would otherwise hide. Anything with an includeDrafts-
// style parameter (getStoryBySlug, getChaptersForStory, getAuthorStories...)
// is intentionally left uncached and on the per-request RLS-scoped client.
const CACHE_SECONDS = 60;

export const getPopularStories = unstable_cache(
  async (limit = 8, offset = 0): Promise<Paginated<StoryCard>> => {
    try {
      const supabase = createPublicClient();
      const { data, count } = await supabase
        .from("stories")
        .select("*, author:profiles!stories_author_id_fkey(username, display_name)", { count: "exact" })
        .eq("status", "published")
        .eq("visibility", "public")
        .order("like_count", { ascending: false })
        .range(offset, offset + limit - 1);
      return { items: (data as StoryCard[]) ?? [], total: count ?? 0 };
    } catch {
      return { items: [], total: 0 };
    }
  },
  ["popular-stories"],
  { revalidate: CACHE_SECONDS, tags: ["stories"] }
);

export const getNewestStories = unstable_cache(
  async (limit = 8, offset = 0): Promise<Paginated<StoryCard>> => {
    try {
      const supabase = createPublicClient();
      const { data, count } = await supabase
        .from("stories")
        .select("*, author:profiles!stories_author_id_fkey(username, display_name)", { count: "exact" })
        .eq("status", "published")
        .eq("visibility", "public")
        .order("published_at", { ascending: false })
        .range(offset, offset + limit - 1);
      return { items: (data as StoryCard[]) ?? [], total: count ?? 0 };
    } catch {
      return { items: [], total: 0 };
    }
  },
  ["newest-stories"],
  { revalidate: CACHE_SECONDS, tags: ["stories"] }
);

export const getStoriesByGenre = unstable_cache(
  async (genre: string, limit = 4, offset = 0): Promise<Paginated<StoryCard>> => {
    try {
      const supabase = createPublicClient();
      const { data, count } = await supabase
        .from("stories")
        .select("*, author:profiles!stories_author_id_fkey(username, display_name)", { count: "exact" })
        .eq("status", "published")
        .eq("visibility", "public")
        .eq("genre", genre)
        .order("like_count", { ascending: false })
        .range(offset, offset + limit - 1);
      return { items: (data as StoryCard[]) ?? [], total: count ?? 0 };
    } catch {
      return { items: [], total: 0 };
    }
  },
  ["stories-by-genre"],
  { revalidate: CACHE_SECONDS, tags: ["stories"] }
);

export type CollectionCardData = Collection & {
  owner: Pick<Profile, "display_name"> | null;
  coverUrls: string[];
  storyCount: number;
};

// Cover art for a collection card is a collage of its first 3 stories'
// covers — there's no separate uploaded image, this is derived from
// collection_items so it always reflects what's actually inside.
export async function attachCollectionCovers(
  supabase: SupabaseClient,
  collections: Collection[]
): Promise<CollectionCardData[]> {
  if (collections.length === 0) return [];
  const { data: items } = await supabase
    .from("collection_items")
    .select("collection_id, story:stories(cover_url)")
    .in(
      "collection_id",
      collections.map((c) => c.id)
    )
    .order("position", { ascending: true });
  const covers = new Map<string, string[]>();
  const counts = new Map<string, number>();
  for (const item of items ?? []) {
    counts.set(item.collection_id, (counts.get(item.collection_id) ?? 0) + 1);
    const coverUrl = (item.story as unknown as { cover_url: string | null } | null)?.cover_url;
    if (!coverUrl) continue;
    const arr = covers.get(item.collection_id) ?? [];
    if (arr.length < 3) arr.push(coverUrl);
    covers.set(item.collection_id, arr);
  }
  return (collections as CollectionCardData[]).map((c) => ({
    ...c,
    coverUrls: covers.get(c.id) ?? [],
    storyCount: counts.get(c.id) ?? 0,
  }));
}

export const getFeaturedCollections = unstable_cache(
  async (limit = 3, offset = 0): Promise<Paginated<CollectionCardData>> => {
    try {
      const supabase = createPublicClient();
      const { data, count } = await supabase
        .from("collections")
        .select("*, owner:profiles!collections_owner_id_fkey(display_name)", { count: "exact" })
        .eq("is_featured", true)
        .eq("is_private", false)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      const items = await attachCollectionCovers(supabase, (data as Collection[]) ?? []);
      return { items, total: count ?? 0 };
    } catch {
      return { items: [], total: 0 };
    }
  },
  ["featured-collections"],
  { revalidate: CACHE_SECONDS, tags: ["collections"] }
);

// Extra hero-banner carousel slides staff added from /admin/banner — slide 1
// itself is hand-built JSX on the homepage, not stored here.
export const getHeroSlides = unstable_cache(
  async (): Promise<HeroSlide[]> => {
    try {
      const supabase = createPublicClient();
      const { data } = await supabase.from("hero_slides").select("*").order("created_at", { ascending: true });
      return (data as HeroSlide[]) ?? [];
    } catch {
      return [];
    }
  },
  ["hero-slides"],
  { revalidate: CACHE_SECONDS, tags: ["hero-slides"] }
);

// Staff-pinned stories for the homepage's Топ дня/недели/месяца section
// (featured_stories, /admin/featured) — ordered "first pinned, shown
// first", not by recency.
export const getTopStories = unstable_cache(
  async (tier: StoryTopTier, limit = 8): Promise<StoryCard[]> => {
    try {
      const supabase = createPublicClient();
      const { data: pins } = await supabase
        .from("featured_stories")
        .select("story_id")
        .eq("tier", tier)
        .order("featured_at", { ascending: true })
        .limit(limit);
      const ids = (pins ?? []).map((p) => p.story_id as string);
      if (ids.length === 0) return [];

      const { data: stories } = await supabase
        .from("stories")
        .select("*, author:profiles!stories_author_id_fkey(username, display_name)")
        .in("id", ids)
        .eq("status", "published")
        .eq("visibility", "public");
      const byId = new Map((stories ?? []).map((s) => [s.id as string, s]));
      return ids.map((id) => byId.get(id)).filter(Boolean) as StoryCard[];
    } catch {
      return [];
    }
  },
  ["top-stories"],
  { revalidate: CACHE_SECONDS, tags: ["stories"] }
);

// Collections that include at least one of this author's published stories —
// "recommended" in the sense of "readers of this author might like these",
// not a staff curation (that's the author_of_month-style achievement badges
// instead, assigned from /admin/users).
export async function getCollectionsFeaturingAuthor(authorId: string, limit = 6): Promise<CollectionCardData[]> {
  try {
    const supabase = await createClient();
    const { data: authorStories } = await supabase
      .from("stories")
      .select("id")
      .eq("author_id", authorId)
      .eq("status", "published");
    const storyIds = (authorStories ?? []).map((s) => s.id);
    if (storyIds.length === 0) return [];

    const { data: items } = await supabase
      .from("collection_items")
      .select("collection_id")
      .in("story_id", storyIds);
    const collectionIds = [...new Set((items ?? []).map((i) => i.collection_id))];
    if (collectionIds.length === 0) return [];

    const { data: collections } = await supabase
      .from("collections")
      .select("*, owner:profiles!collections_owner_id_fkey(display_name)")
      .in("id", collectionIds)
      .eq("is_private", false)
      .order("created_at", { ascending: false })
      .limit(limit);
    return attachCollectionCovers(supabase, (collections as Collection[]) ?? []);
  } catch {
    return [];
  }
}

export const getRecentPublishedChapters = unstable_cache(
  async (limit = 3, offset = 0) => {
    try {
      const supabase = createPublicClient();
      const { data, count } = await supabase
        .from("chapters")
        .select("*, story:stories(id, title, slug, cover_url, status, visibility)", { count: "exact" })
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .range(offset, offset + limit - 1);
      return { items: data ?? [], total: count ?? 0 };
    } catch {
      return { items: [], total: 0 };
    }
  },
  ["recent-published-chapters"],
  { revalidate: CACHE_SECONDS, tags: ["stories"] }
);

export type StoryDetail = Story & {
  author: Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;
};

export async function getStoryBySlug(slug: string): Promise<StoryDetail | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("stories")
      .select("*, author:profiles!stories_author_id_fkey(id, username, display_name, avatar_url)")
      .eq("slug", slug)
      .single();
    return (data as StoryDetail) ?? null;
  } catch {
    return null;
  }
}

export async function getChaptersForStory(
  storyId: string,
  includeDrafts = false
): Promise<Chapter[]> {
  try {
    const supabase = await createClient();
    let query = supabase.from("chapters").select("*").eq("story_id", storyId);
    if (!includeDrafts) query = query.eq("status", "published");
    const { data } = await query.order("order_index", { ascending: true });
    return (data as Chapter[]) ?? [];
  } catch {
    return [];
  }
}

export async function getChapter(storyId: string, orderIndex: number): Promise<Chapter | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("chapters")
      .select("*")
      .eq("story_id", storyId)
      .eq("order_index", orderIndex)
      .eq("status", "published")
      .single();
    return (data as Chapter) ?? null;
  } catch {
    return null;
  }
}

export async function getContinueReading(userId: string, limit = 3) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("reading_progress")
      .select("percent, updated_at, story:stories(id, title, slug, cover_url)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  } catch {
    return [];
  }
}

export interface SearchFilters {
  q?: string;
  language?: string;
  genre?: string;
  status?: string;
  age?: string;
  relationship?: string;
  style?: string;
  warnings?: string[];
  sort?: "popular" | "newest" | "views";
}

async function storyIdsForTag(
  supabase: Awaited<ReturnType<typeof createClient>>,
  category: string,
  label: string
): Promise<string[] | null> {
  const { data: tag } = await supabase
    .from("tags")
    .select("id")
    .eq("category", category)
    .eq("label_ru", label)
    .maybeSingle();
  if (!tag) return [];
  const { data: rows } = await supabase.from("story_tags").select("story_id").eq("tag_id", tag.id);
  return (rows ?? []).map((r) => r.story_id as string);
}

export const searchStories = unstable_cache(
  async (filters: SearchFilters): Promise<StoryCard[]> => {
    try {
      const supabase = createPublicClient();
      let query = supabase
        .from("stories")
        .select("*, author:profiles!stories_author_id_fkey(username, display_name)")
        .eq("status", "published")
        .eq("visibility", "public");

      if (filters.q) query = query.ilike("title", `%${filters.q}%`);
      if (filters.language) query = query.eq("language", filters.language);
      if (filters.genre) query = query.eq("genre", filters.genre);
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.age) query = query.eq("age_rating", filters.age);
      if (filters.relationship) query = query.eq("relationship_type", filters.relationship);

      if (filters.style) {
        const ids = await storyIdsForTag(supabase, "style", filters.style);
        query = query.in("id", ids && ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
      }

      for (const warning of filters.warnings ?? []) {
        const ids = await storyIdsForTag(supabase, "warning", warning);
        query = query.in("id", ids && ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
      }

      if (filters.sort === "newest") query = query.order("published_at", { ascending: false });
      else if (filters.sort === "views") query = query.order("view_count", { ascending: false });
      else query = query.order("like_count", { ascending: false });

      const { data } = await query.limit(40);
      const results = (data as StoryCard[]) ?? [];
      if (results.length === 0) return results;

      // Staff-pinned stories (any tier — featured_stories, /admin/featured)
      // that appear in the results move to the front, earliest-pinned first;
      // everything else keeps its existing relative order (stable sort).
      const { data: pins } = await supabase.from("featured_stories").select("story_id, featured_at");
      if (!pins || pins.length === 0) return results;
      const ranks = new Map<string, number>();
      for (const pin of pins) {
        const ts = new Date(pin.featured_at).getTime();
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
    } catch {
      return [];
    }
  },
  ["search-stories"],
  { revalidate: CACHE_SECONDS, tags: ["stories"] }
);

export async function getBookmarkedStories(userId: string): Promise<StoryCard[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("bookmarks")
      .select("story:stories(*, author:profiles!stories_author_id_fkey(username, display_name))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return ((data ?? []).map((row) => row.story).filter(Boolean) as unknown) as StoryCard[];
  } catch {
    return [];
  }
}

export async function getMyCollections(userId: string): Promise<CollectionCardData[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("collections")
      .select("*, owner:profiles!collections_owner_id_fkey(display_name)")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    return attachCollectionCovers(supabase, (data as Collection[]) ?? []);
  } catch {
    return [];
  }
}

export type CollectionPickerItem = { id: string; title: string; hasStory: boolean };

// The list an "add to collection" dropdown needs: every collection the
// viewer owns, flagged with whether this particular story is already in it.
export async function getMyCollectionsWithStory(userId: string, storyId: string): Promise<CollectionPickerItem[]> {
  try {
    const supabase = await createClient();
    const [{ data: collections }, { data: items }] = await Promise.all([
      supabase
        .from("collections")
        .select("id, title")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("collection_items").select("collection_id").eq("story_id", storyId),
    ]);
    const inCollectionIds = new Set((items ?? []).map((i) => i.collection_id));
    return (collections ?? []).map((c) => ({ id: c.id, title: c.title, hasStory: inCollectionIds.has(c.id) }));
  } catch {
    return [];
  }
}

export async function getStoriesByReadingStatus(userId: string, status: string): Promise<StoryCard[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("reading_statuses")
      .select("story:stories(*, author:profiles!stories_author_id_fkey(username, display_name))")
      .eq("user_id", userId)
      .eq("status", status)
      .order("updated_at", { ascending: false });
    return ((data ?? []).map((row) => row.story).filter(Boolean) as unknown) as StoryCard[];
  } catch {
    return [];
  }
}

export async function getAuthorStories(authorId: string, includeDrafts: boolean): Promise<StoryCard[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("stories")
      .select("*, author:profiles!stories_author_id_fkey(username, display_name)")
      .eq("author_id", authorId);
    if (!includeDrafts) query = query.eq("status", "published").eq("visibility", "public");
    const { data } = await query.order("created_at", { ascending: false });
    return (data as StoryCard[]) ?? [];
  } catch {
    return [];
  }
}

export const getPublicCollections = unstable_cache(
  async (ownerType?: string | string[]): Promise<CollectionCardData[]> => {
    try {
      const supabase = createPublicClient();
      let query = supabase
        .from("collections")
        .select("*, owner:profiles!collections_owner_id_fkey(display_name)")
        .eq("is_private", false);
      if (Array.isArray(ownerType)) query = query.in("owner_type", ownerType);
      else if (ownerType) query = query.eq("owner_type", ownerType);
      const { data } = await query
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });
      return attachCollectionCovers(supabase, (data as Collection[]) ?? []);
    } catch {
      return [];
    }
  },
  ["public-collections"],
  { revalidate: CACHE_SECONDS, tags: ["collections"] }
);

export async function getSavedCollections(userId: string): Promise<CollectionCardData[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("saved_collections")
      .select("collection:collections(*, owner:profiles!collections_owner_id_fkey(display_name))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    const collections = ((data ?? []).map((row) => row.collection).filter(Boolean) as unknown) as Collection[];
    return attachCollectionCovers(supabase, collections);
  } catch {
    return [];
  }
}

export async function isCollectionSaved(userId: string | undefined, collectionId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("saved_collections")
      .select("collection_id")
      .eq("user_id", userId)
      .eq("collection_id", collectionId)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function getCollectionWithStories(id: string) {
  try {
    const supabase = await createClient();
    const { data: collection } = await supabase.from("collections").select("*").eq("id", id).single();
    if (!collection) return null;
    const { data: items } = await supabase
      .from("collection_items")
      .select("position, story:stories(*, author:profiles!stories_author_id_fkey(username, display_name))")
      .eq("collection_id", id)
      .order("position", { ascending: true });
    return { collection, stories: (items ?? []).map((i) => i.story).filter(Boolean) as unknown as StoryCard[] };
  } catch {
    return null;
  }
}

// Existing tag labels for the "type or pick" tag adder on create/edit-story
// forms — genre/age_rating/relationship-type are handled by their own
// dedicated single-select pickers, so this only offers warning/style tags
// plus whatever authors have already typed in.
export const getAllTags = unstable_cache(
  async (): Promise<string[]> => {
    try {
      const supabase = createPublicClient();
      const { data } = await supabase
        .from("tags")
        .select("label_ru")
        .in("category", ["warning", "style"])
        .order("label_ru", { ascending: true });
      return Array.from(new Set((data ?? []).map((t) => t.label_ru)));
    } catch {
      return [];
    }
  },
  ["all-tags"],
  { revalidate: CACHE_SECONDS, tags: ["tags"] }
);

export async function getTagsForStory(storyId: string): Promise<string[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("story_tags")
      .select("tag:tags(label_ru)")
      .eq("story_id", storyId);
    return (data ?? [])
      .map((row) => (row.tag as unknown as { label_ru: string } | null)?.label_ru)
      .filter((label): label is string => Boolean(label));
  } catch {
    return [];
  }
}

export const getGuestFreeChapterCount = unstable_cache(
  async (): Promise<number> => {
    try {
      const supabase = createPublicClient();
      const { data } = await supabase
        .from("platform_settings")
        .select("guest_free_chapters")
        .eq("id", 1)
        .single();
      return data?.guest_free_chapters ?? 1;
    } catch {
      return 1;
    }
  },
  ["guest-free-chapter-count"],
  { revalidate: CACHE_SECONDS, tags: ["settings"] }
);
