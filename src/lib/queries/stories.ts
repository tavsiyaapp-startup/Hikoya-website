import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Story, Chapter, Collection, Profile } from "@/types/database";

// Every query here tolerates an unreachable Supabase project (placeholder
// .env.local before a real project is wired up) by returning an empty
// result instead of throwing, so pages render their empty states.

export type StoryCard = Story & { author: Pick<Profile, "username" | "display_name"> };

export async function getPopularStories(limit = 8): Promise<StoryCard[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("stories")
      .select("*, author:profiles!stories_author_id_fkey(username, display_name)")
      .eq("status", "published")
      .eq("visibility", "public")
      .order("like_count", { ascending: false })
      .limit(limit);
    return (data as StoryCard[]) ?? [];
  } catch {
    return [];
  }
}

export async function getNewestStories(limit = 8): Promise<StoryCard[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("stories")
      .select("*, author:profiles!stories_author_id_fkey(username, display_name)")
      .eq("status", "published")
      .eq("visibility", "public")
      .order("published_at", { ascending: false })
      .limit(limit);
    return (data as StoryCard[]) ?? [];
  } catch {
    return [];
  }
}

export async function getStoriesByGenre(genre: string, limit = 4): Promise<StoryCard[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("stories")
      .select("*, author:profiles!stories_author_id_fkey(username, display_name)")
      .eq("status", "published")
      .eq("visibility", "public")
      .eq("genre", genre)
      .order("like_count", { ascending: false })
      .limit(limit);
    return (data as StoryCard[]) ?? [];
  } catch {
    return [];
  }
}

export async function getFeaturedCollections(limit = 3): Promise<Collection[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("collections")
      .select("*")
      .eq("is_featured", true)
      .eq("is_private", false)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data as Collection[]) ?? [];
  } catch {
    return [];
  }
}

export async function getRecentPublishedChapters(limit = 3) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("chapters")
      .select("*, story:stories(id, title, slug, cover_url, status, visibility)")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  } catch {
    return [];
  }
}

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

export async function searchStories(filters: SearchFilters): Promise<StoryCard[]> {
  try {
    const supabase = await createClient();
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

    for (const [category, label] of [
      ["relationship", filters.relationship],
      ["style", filters.style],
    ] as const) {
      if (!label) continue;
      const ids = await storyIdsForTag(supabase, category, label);
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
    return (data as StoryCard[]) ?? [];
  } catch {
    return [];
  }
}

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

export async function getMyCollections(userId: string): Promise<Collection[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("collections")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    return (data as Collection[]) ?? [];
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

export async function getPublicCollections(ownerType?: string): Promise<Collection[]> {
  try {
    const supabase = await createClient();
    let query = supabase.from("collections").select("*").eq("is_private", false);
    if (ownerType) query = query.eq("owner_type", ownerType);
    const { data } = await query.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
    return (data as Collection[]) ?? [];
  } catch {
    return [];
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

export async function getGuestFreeChapterCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("guest_free_chapters")
      .eq("id", 1)
      .single();
    return data?.guest_free_chapters ?? 1;
  } catch {
    return 1;
  }
}
