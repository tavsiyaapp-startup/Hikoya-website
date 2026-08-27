"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify, withRandomSuffix } from "@/lib/slug";
import { sanitizeHtml } from "@/lib/sanitize";
import { ROUTES } from "@/lib/constants";
import type { AgeRating, ChapterStatus, ContentLanguage, StoryStatus, StoryVisibility } from "@/types/database";

export interface CreateStoryInput {
  title: string;
  description: string;
  coverUrl: string | null;
  genre: string;
  relationshipType: string | null;
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

// Chapter content is HTML from RichTextEditor now, not plain text — strip
// tags before counting words, otherwise every tag gets counted as a "word".
// A no-op for legacy plain-text content (nothing to strip).
function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ");
}

async function requiresReview(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("platform_settings")
    .select("new_story_requires_review")
    .eq("id", 1)
    .single();
  return data?.new_story_requires_review ?? false;
}

// `tags` write access is staff-only via RLS (spam prevention on a shared,
// site-wide table) — the admin client is what lets an author's freshly
// typed tag actually get created, gated only by them owning the story
// they're tagging (checked by the caller's own story_tags RLS policy).
// New tags default to the 'style' category since this field isn't
// category-specific from the author's point of view.
async function resolveTagIds(labels: string[]): Promise<string[]> {
  if (labels.length === 0) return [];
  const admin = createAdminClient();

  const { data: existing } = await admin.from("tags").select("id, label_ru").in("label_ru", labels);
  const foundLabels = new Set((existing ?? []).map((t) => t.label_ru));
  const ids = (existing ?? []).map((t) => t.id as string);

  const missing = labels.filter((label) => !foundLabels.has(label));
  if (missing.length > 0) {
    const { data: created } = await admin
      .from("tags")
      .upsert(
        missing.map((label) => ({ category: "style", label_ru: label, label_uz: label })),
        { onConflict: "category,label_ru" }
      )
      .select("id");
    ids.push(...(created ?? []).map((t) => t.id as string));
    updateTag("tags");
  }

  return ids;
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
      relationship_type: input.relationshipType,
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

  const chapterContent = sanitizeHtml(input.chapterText);
  await supabase.from("chapters").insert({
    story_id: story.id,
    order_index: 1,
    title: input.chapterTitle,
    content: chapterContent,
    word_count: wordCount(stripHtml(chapterContent)),
    status,
    is_free: true,
    published_at: status === "published" ? new Date().toISOString() : null,
  });

  const tagIds = await resolveTagIds(input.tags);
  if (tagIds.length > 0) {
    await supabase.from("story_tags").insert(tagIds.map((tagId) => ({ story_id: story.id, tag_id: tagId })));
  }

  await supabase.from("profiles").update({ role: "author" }).eq("id", user.id).eq("role", "reader");

  updateTag("stories");
  revalidatePath(ROUTES.home);
  // Doesn't redirect itself — CreateWizard may still need to attach more
  // chapters (docx import produces several) via addChapter before sending
  // the browser to the new story's manage page.
  return { id: story.id as string, slug: story.slug as string };
}

export interface UpdateStoryInput {
  description: string;
  coverUrl: string | null;
  genre: string;
  relationshipType: string | null;
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
      relationship_type: input.relationshipType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", storyId);

  await supabase.from("story_tags").delete().eq("story_id", storyId);
  const tagIds = await resolveTagIds(input.tags);
  if (tagIds.length > 0) {
    await supabase.from("story_tags").insert(tagIds.map((tagId) => ({ story_id: storyId, tag_id: tagId })));
  }

  updateTag("stories");
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
  const rawContent = String(formData.get("content") ?? "").trim();
  if (!title || !rawContent) return;
  const content = sanitizeHtml(rawContent);

  await supabase
    .from("chapters")
    .update({
      title,
      content,
      word_count: wordCount(stripHtml(content)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", chapterId)
    .eq("story_id", storyId);

  updateTag("stories");
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

  updateTag("stories");
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
  const rawContent = String(formData.get("content") ?? "").trim();
  if (!title || !rawContent) return;
  const content = sanitizeHtml(rawContent);

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
    word_count: wordCount(stripHtml(content)),
    status,
    is_free: false,
    published_at: status === "published" ? new Date().toISOString() : null,
  });

  updateTag("stories");
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
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
      rejection_reason: null,
    })
    .eq("id", storyId)
    .eq("status", "draft");

  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
  revalidatePath(ROUTES.home);
}

// Author-only — RLS enforces this on the delete itself (see migration
// 0027, which also removed staff's delete rights: admin can only hide a
// story, never delete it). The ownership check here runs first so the
// admin-client cleanup below — needed because `likes` is polymorphic
// (target_type/target_id, no FK) and can't be scoped by RLS the way an
// owned row can — never touches another author's story.
export async function deleteStory(storyId: string, storySlug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const { data: story } = await supabase.from("stories").select("author_id").eq("id", storyId).single();
  if (!story || story.author_id !== user.id) return;

  const admin = createAdminClient();
  const { data: chapterRows } = await admin.from("chapters").select("id").eq("story_id", storyId);
  const chapterIds = (chapterRows ?? []).map((c) => c.id as string);

  let commentIds: string[] = [];
  if (chapterIds.length > 0) {
    const { data: commentRows } = await admin.from("comments").select("id").in("chapter_id", chapterIds);
    commentIds = (commentRows ?? []).map((c) => c.id as string);
  }

  await admin.from("likes").delete().eq("target_type", "story").eq("target_id", storyId);
  if (chapterIds.length > 0) {
    await admin.from("likes").delete().eq("target_type", "chapter").in("target_id", chapterIds);
  }
  if (commentIds.length > 0) {
    await admin.from("likes").delete().eq("target_type", "comment").in("target_id", commentIds);
  }

  // chapters/comments/bookmarks/reading_statuses/story_tags/collection_stories/
  // featured_stories cascade; notifications/request_responses.story_id go null.
  await supabase.from("stories").delete().eq("id", storyId).eq("author_id", user.id);

  updateTag("stories");
  revalidatePath(ROUTES.story(storySlug));
  revalidatePath(ROUTES.home);
  revalidatePath(ROUTES.search);
  redirect(ROUTES.library);
}

export async function submitChapterForReview(chapterId: string, storyId: string, storySlug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const status: ChapterStatus = (await requiresReview(supabase)) ? "pending_review" : "published";

  await supabase
    .from("chapters")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
      rejection_reason: null,
    })
    .eq("id", chapterId)
    .eq("story_id", storyId)
    .eq("status", "draft");

  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
}
