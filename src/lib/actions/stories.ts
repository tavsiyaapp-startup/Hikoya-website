"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify, withRandomSuffix } from "@/lib/slug";
import { ROUTES } from "@/lib/constants";
import type { AgeRating, ChapterStatus, ContentLanguage, StoryStatus, StoryVisibility } from "@/types/database";

export interface CreateStoryInput {
  title: string;
  description: string;
  coverUrl: string | null;
  genre: string;
  tags: string[];
  language: ContentLanguage;
  ageRating: AgeRating;
  chapterTitle: string;
  chapterText: string;
  visibility: StoryVisibility;
  announce: string | null;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function requiresReview(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("platform_settings")
    .select("new_story_requires_review")
    .eq("id", 1)
    .single();
  return data?.new_story_requires_review ?? false;
}

export async function createStory(input: CreateStoryInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const status: StoryStatus =
    input.visibility === "draft" ? "draft" : (await requiresReview(supabase)) ? "pending_review" : "published";
  const slug = withRandomSuffix(slugify(input.title));

  const { data: story, error } = await supabase
    .from("stories")
    .insert({
      author_id: user.id,
      title: input.title,
      slug,
      description: input.description,
      cover_url: input.coverUrl,
      genre: input.genre,
      language: input.language,
      age_rating: input.ageRating,
      status,
      visibility: input.visibility,
      announce: input.announce,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select("id, slug")
    .single();

  if (error || !story) {
    throw new Error(error?.message ?? "Failed to create story");
  }

  await supabase.from("chapters").insert({
    story_id: story.id,
    order_index: 1,
    title: input.chapterTitle,
    content: input.chapterText,
    word_count: wordCount(input.chapterText),
    status,
    is_free: true,
    published_at: status === "published" ? new Date().toISOString() : null,
  });

  if (input.tags.length > 0) {
    const { data: tagRows } = await supabase
      .from("tags")
      .select("id, label_ru")
      .in("label_ru", input.tags);
    if (tagRows && tagRows.length > 0) {
      await supabase
        .from("story_tags")
        .insert(tagRows.map((tag) => ({ story_id: story.id, tag_id: tag.id })));
    }
  }

  await supabase.from("profiles").update({ role: "author" }).eq("id", user.id).eq("role", "reader");

  revalidatePath(ROUTES.home);
  redirect(ROUTES.manage(story.slug));
}

export interface UpdateStoryInput {
  description: string;
  coverUrl: string | null;
  genre: string;
  tags: string[];
}

export async function updateStory(
  storyId: string,
  storySlug: string,
  input: UpdateStoryInput
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  await supabase
    .from("stories")
    .update({
      description: input.description,
      cover_url: input.coverUrl,
      genre: input.genre,
      updated_at: new Date().toISOString(),
    })
    .eq("id", storyId);

  await supabase.from("story_tags").delete().eq("story_id", storyId);
  if (input.tags.length > 0) {
    const { data: tagRows } = await supabase
      .from("tags")
      .select("id, label_ru")
      .in("label_ru", input.tags);
    if (tagRows && tagRows.length > 0) {
      await supabase
        .from("story_tags")
        .insert(tagRows.map((tag) => ({ story_id: storyId, tag_id: tag.id })));
    }
  }

  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
  revalidatePath(ROUTES.home);
}

export async function updateChapter(
  chapterId: string,
  storyId: string,
  storySlug: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!title || !content) return;

  await supabase
    .from("chapters")
    .update({
      title,
      content,
      word_count: wordCount(content),
      updated_at: new Date().toISOString(),
    })
    .eq("id", chapterId)
    .eq("story_id", storyId);

  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
}

export async function deleteChapter(chapterId: string, storyId: string, storySlug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  await supabase.from("chapters").delete().eq("id", chapterId).eq("story_id", storyId);

  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
}

export async function addChapter(storyId: string, storySlug: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!title || !content) return;

  const { data: last } = await supabase
    .from("chapters")
    .select("order_index")
    .eq("story_id", storyId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextIndex = (last?.order_index ?? 0) + 1;
  const status: ChapterStatus = (await requiresReview(supabase)) ? "pending_review" : "published";

  await supabase.from("chapters").insert({
    story_id: storyId,
    order_index: nextIndex,
    title,
    content,
    word_count: wordCount(content),
    status,
    is_free: false,
    published_at: status === "published" ? new Date().toISOString() : null,
  });

  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
}

export async function submitStoryForReview(storyId: string, storySlug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const status: StoryStatus = (await requiresReview(supabase)) ? "pending_review" : "published";

  await supabase
    .from("stories")
    .update({ status, published_at: status === "published" ? new Date().toISOString() : null })
    .eq("id", storyId)
    .eq("status", "draft");

  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
  revalidatePath(ROUTES.home);
}
