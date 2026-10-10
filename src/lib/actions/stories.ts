"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getAuth } from "@/server/auth/config";
import { getDb, type DbOrTx } from "@/server/db/client";
import { chapters, customLanguages, profiles, stories } from "@/server/db/schema";
import { loadViewer } from "@/server/data/viewer";
import { getRequiresReview } from "@/server/data/settings";
import * as storiesData from "@/server/data/stories";
import * as chaptersData from "@/server/data/chapters";
import { notifyPendingReview } from "@/lib/telegram";
import { ROUTES } from "@/lib/constants";
import type { AgeRating, StoryProgressStatus, StoryVisibility } from "@/types/database";

// Identity comes from Better Auth now, not Supabase — the actual authz
// (who may create/edit/delete what) moved to src/server/authz/policy.ts +
// src/server/data/stories.ts|chapters.ts, built and tested earlier this
// migration but never wired to a live caller until now. This file is only
// the thin "resolve the signed-in viewer, call the data layer, revalidate/
// notify" wrapper every Server Action below needs — same role
// requireViewerId() plays in lib/actions/social.ts.
async function requireViewer() {
  const db = getDb();
  const session = await getAuth().api.getSession({ headers: await headers() });
  const viewer = await loadViewer(db, session?.user.id);
  if (!viewer) redirect(ROUTES.onboarding);
  return { db, viewer };
}

async function getAuthorDisplayName(db: DbOrTx, userId: string): Promise<string> {
  const [row] = await db.select({ display_name: profiles.display_name }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  return row?.display_name ?? "Автор";
}

// stories.language is free text (not limited to ru/uz) — when an author
// types one that isn't ru/uz, register it here so it shows up as a pickable
// chip for every author afterwards, and in the search-by-language filter.
// Purely a UI nice-to-have, which is why it lives here rather than in the
// data layer itself (server/data/stories.ts's createStory doesn't do this).
async function registerCustomLanguage(db: DbOrTx, language: string) {
  if (language === "ru" || language === "uz") return;
  await db.insert(customLanguages).values({ label: language }).onConflictDoNothing({ target: customLanguages.label });
  updateTag("custom-languages");
}

export interface CreateStoryInput {
  title: string;
  description: string;
  coverUrl: string | null;
  genres: string[];
  relationshipType: string | null;
  tags: string[];
  language: string;
  ageRating: AgeRating;
  isTranslation: boolean;
  chapterTitle: string;
  chapterText: string;
  visibility: StoryVisibility;
  announce: string | null;
}

export async function createStory(input: CreateStoryInput) {
  const { db, viewer } = await requireViewer();
  const language = input.language.trim() || "ru";

  const story = await storiesData.createStory(db, viewer, {
    title: input.title,
    description: input.description,
    coverUrl: input.coverUrl,
    genres: input.genres,
    relationshipType: input.relationshipType,
    tagLabels: input.tags,
    language,
    ageRating: input.ageRating,
    isTranslation: input.isTranslation,
    chapterTitle: input.chapterTitle,
    chapterText: input.chapterText,
    visibility: input.visibility,
    announce: input.announce,
  });

  await registerCustomLanguage(db, language);

  if (story.status === "pending_review") {
    const authorName = await getAuthorDisplayName(db, viewer.id);
    await notifyPendingReview({ kind: "story", authorName, storyTitle: input.title, storyId: story.id });
  }

  updateTag("stories");
  revalidatePath(ROUTES.home);
  // Doesn't redirect itself — CreateWizard may still need to attach more
  // chapters (docx import produces several) via addChapter before sending
  // the browser to the new story's manage page.
  return { id: story.id, slug: story.slug };
}

export interface UpdateStoryInput {
  title: string;
  description: string;
  coverUrl: string | null;
  genres: string[];
  relationshipType: string | null;
  tags: string[];
  progressStatus: StoryProgressStatus;
  isTranslation: boolean;
}

export async function updateStory(storyId: string, storySlug: string, input: UpdateStoryInput) {
  const { db, viewer } = await requireViewer();
  const title = input.title.trim();
  if (!title) return;

  await storiesData.updateStory(db, viewer, storyId, {
    title,
    description: input.description,
    coverUrl: input.coverUrl,
    genres: input.genres,
    relationshipType: input.relationshipType,
    tagLabels: input.tags,
    progressStatus: input.progressStatus,
    isTranslation: input.isTranslation,
  });

  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
  revalidatePath(ROUTES.home);
}

export async function updateChapter(chapterId: string, storyId: string, storySlug: string, formData: FormData) {
  const { db, viewer } = await requireViewer();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!title || !content) return;

  await chaptersData.updateChapter(db, viewer, chapterId, { title, content });

  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
}

export async function deleteChapter(chapterId: string, storyId: string, storySlug: string) {
  const { db, viewer } = await requireViewer();
  await chaptersData.deleteChapter(db, viewer, chapterId);

  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
}

export async function addChapter(storyId: string, storySlug: string, formData: FormData) {
  const { db, viewer } = await requireViewer();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!title || !content) return;

  const chapter = await chaptersData.addChapter(db, viewer, storyId, { title, content });

  if (chapter.status === "pending_review") {
    const [storyRow] = await db.select({ title: stories.title }).from(stories).where(eq(stories.id, storyId)).limit(1);
    const authorName = await getAuthorDisplayName(db, viewer.id);
    await notifyPendingReview({
      kind: "chapter",
      authorName,
      storyTitle: storyRow?.title ?? "",
      chapterTitle: title,
      storyId,
    });
  }

  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
}

export async function submitStoryForReview(storyId: string, storySlug: string) {
  const { db, viewer } = await requireViewer();
  const requiresReview = await getRequiresReview(db);

  await storiesData.submitStoryForReview(db, viewer, storyId);

  if (requiresReview) {
    const [storyRow] = await db.select({ title: stories.title }).from(stories).where(eq(stories.id, storyId)).limit(1);
    if (storyRow) {
      const authorName = await getAuthorDisplayName(db, viewer.id);
      await notifyPendingReview({ kind: "story", authorName, storyTitle: storyRow.title, storyId });
    }
  }

  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
  revalidatePath(ROUTES.home);
}

// Author-only soft delete — moves the story to the admin trash instead of
// removing it outright. Flipping status to 'draft' alongside deleted_at
// means every existing status='published' filter across the app already
// stops surfacing it for free, and if staff later restores it
// (deleted_at -> null), it's already sitting in drafts for the author to
// review and republish themselves.
export async function deleteStory(storyId: string, storySlug: string) {
  const { db, viewer } = await requireViewer();
  await storiesData.deleteStory(db, viewer, storyId);

  updateTag("stories");
  revalidatePath(ROUTES.story(storySlug));
  revalidatePath(ROUTES.home);
  revalidatePath(ROUTES.search);
  redirect(ROUTES.library);
}

export async function submitChapterForReview(chapterId: string, storyId: string, storySlug: string) {
  const { db, viewer } = await requireViewer();
  const requiresReview = await getRequiresReview(db);

  await chaptersData.submitChapterForReview(db, viewer, chapterId);

  if (requiresReview) {
    const [chapterRow] = await db.select({ title: chapters.title }).from(chapters).where(eq(chapters.id, chapterId)).limit(1);
    if (chapterRow) {
      const [storyRow] = await db.select({ title: stories.title }).from(stories).where(eq(stories.id, storyId)).limit(1);
      const authorName = await getAuthorDisplayName(db, viewer.id);
      await notifyPendingReview({
        kind: "chapter",
        authorName,
        storyTitle: storyRow?.title ?? "",
        chapterTitle: chapterRow.title,
        storyId,
      });
    }
  }

  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
}
