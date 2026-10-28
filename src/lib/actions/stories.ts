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
import { ChapterTooLongError } from "@/server/data/errors";
import { notifyPendingReview } from "@/lib/telegram";
import { getPublishGate, loadPaywallState } from "@/server/data/paywall";
import type { Viewer } from "@/server/authz/policy";
import { uploadUrlPrefix } from "@/server/storage/local";
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

// «Obuna»: may this author publish one more chapter now? Any failure here
// (e.g. paywall.sql not run) means "yes" — the site works as before.
async function canPublishNow(db: DbOrTx, viewer: Viewer): Promise<boolean> {
  try {
    const state = await loadPaywallState(db);
    if (!state.live) return true;
    return (await getPublishGate(db, viewer, state)).allowed;
  } catch (err) {
    console.error("[stories] publish gate check failed", err);
    return true;
  }
}

// A cover must be a file this user uploaded through uploadUserImage (their
// own /uploads/covers/<id>/ folder). Anything else — an arbitrary external
// URL — would let an author embed a tracking image that reports every
// reader's IP address.
function isOwnCoverUpload(url: string, userId: string): boolean {
  return url.startsWith(uploadUrlPrefix("covers", userId)) && !url.includes("..");
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
  // Becomes a chip every author sees — only something that looks like a
  // language name (letters, spaces, hyphens) gets registered.
  if (!/^[\p{L}][\p{L} -]{1,39}$/u.test(language)) return;
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

// Returns null when nothing was created (blocked, a field too long, database
// error) — it used to throw, and the wizard just stopped with no message.
export async function createStory(input: CreateStoryInput): Promise<{ id: string; slug: string } | null | "too_long"> {
  const { db, viewer } = await requireViewer();
  const language = input.language.trim() || "ru";

  const coverUrl = input.coverUrl && isOwnCoverUpload(input.coverUrl, viewer.id) ? input.coverUrl : null;
  // Without a subscription (when one is needed) the story is kept as a
  // draft; the author publishes it from the manage page once subscribed.
  const visibility = input.visibility !== "draft" && !(await canPublishNow(db, viewer)) ? "draft" : input.visibility;

  let story: Awaited<ReturnType<typeof storiesData.createStory>>;
  try {
    story = await storiesData.createStory(db, viewer, {
      title: input.title,
      description: input.description,
      coverUrl,
      genres: input.genres,
      relationshipType: input.relationshipType,
      tagLabels: input.tags,
      language,
      ageRating: input.ageRating,
      isTranslation: input.isTranslation,
      chapterTitle: input.chapterTitle,
      chapterText: input.chapterText,
      visibility,
      announce: input.announce,
    });
  } catch (err) {
    if (err instanceof ChapterTooLongError) return "too_long";
    console.error("[stories] createStory failed", viewer.id, err);
    return null;
  }

  // The story is saved from here on; these are extras and only logged.
  try {
    await registerCustomLanguage(db, language);
  } catch (err) {
    console.error("[stories] registerCustomLanguage failed", language, err);
  }
  if (story.status === "pending_review") {
    await pingModerators({ kind: "story", db, authorId: viewer.id, storyId: story.id });
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

// Returns false when nothing was saved (empty title, foreign cover url,
// forbidden, database error) — EditStoryForm relies on it to keep the old
// cover file instead of deleting it after a save that didn't happen.
export async function updateStory(storyId: string, storySlug: string, input: UpdateStoryInput): Promise<boolean> {
  const { db, viewer } = await requireViewer();
  const title = input.title.trim();
  if (!title) return false;

  try {
    if (input.coverUrl) {
      const [current] = await db.select({ cover_url: stories.cover_url }).from(stories).where(eq(stories.id, storyId)).limit(1);
      // Keeping the cover the story already has (including an older
      // Supabase-hosted one) is always fine; a new one must be the viewer's own upload.
      if (input.coverUrl !== current?.cover_url && !isOwnCoverUpload(input.coverUrl, viewer.id)) return false;
    }
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
  } catch (err) {
    console.error("[stories] updateStory failed", storyId, err);
    return false;
  }

  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
  revalidatePath(ROUTES.home);
  return true;
}

// "saved" | "review" (saved, and sent back to moderation because an
// approved chapter was edited while pre-moderation is on) | false (not
// saved: empty, too long, forbidden, database error). The edit form stays
// open with the text on false.
export async function updateChapter(
  chapterId: string,
  storyId: string,
  storySlug: string,
  formData: FormData
): Promise<"saved" | "review" | false | "too_long"> {
  const { db, viewer } = await requireViewer();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!title || !content) return false;

  let updated: Awaited<ReturnType<typeof chaptersData.updateChapter>>;
  try {
    updated = await chaptersData.updateChapter(db, viewer, chapterId, { title, content });
  } catch (err) {
    if (err instanceof ChapterTooLongError) return "too_long";
    console.error("[stories] updateChapter failed", chapterId, err);
    return false;
  }

  if (updated.wentBackToReview) {
    await pingModerators({ kind: "chapter", db, authorId: viewer.id, storyId, chapterTitle: title });
  }

  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
  return updated.wentBackToReview ? "review" : "saved";
}

export async function deleteChapter(chapterId: string, storyId: string, storySlug: string): Promise<boolean> {
  const { db, viewer } = await requireViewer();
  try {
    await chaptersData.deleteChapter(db, viewer, chapterId);
  } catch (err) {
    console.error("[stories] deleteChapter failed", chapterId, err);
    return false;
  }

  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
  return true;
}

// Returns false when the chapter wasn't saved (empty, forbidden, database
// error) so the form can keep the text and say so — it used to throw or
// return nothing, and every caller closed the form either way.
// "draft": saved, but not published — the author needs a subscription first.
export async function addChapter(storyId: string, storySlug: string, formData: FormData): Promise<boolean | "draft" | "too_long"> {
  const { db, viewer } = await requireViewer();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!title || !content) return false;

  let chapter: Awaited<ReturnType<typeof chaptersData.addChapter>>;
  try {
    chapter = await chaptersData.addChapter(db, viewer, storyId, { title, content }, { asDraft: !(await canPublishNow(db, viewer)) });
  } catch (err) {
    if (err instanceof ChapterTooLongError) return "too_long";
    console.error("[stories] addChapter failed", storyId, err);
    return false;
  }

  // The chapter is already saved — a failing moderator ping must not make
  // the caller think otherwise and retry (that would create a duplicate).
  if (chapter.status === "pending_review") {
    await pingModerators({ kind: "chapter", db, authorId: viewer.id, storyId, chapterTitle: title });
  }

  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
  return chapter.status === "draft" ? "draft" : true;
}

// Moderator ping after something landed in pending_review. Runs after the
// write already committed, so a Telegram or lookup failure is only logged —
// throwing here made the client think the action failed, and a retry then
// produced duplicates.
async function pingModerators(params: {
  kind: "story" | "chapter";
  db: DbOrTx;
  authorId: string;
  storyId: string;
  chapterTitle?: string;
}) {
  try {
    const [storyRow] = await params.db.select({ title: stories.title }).from(stories).where(eq(stories.id, params.storyId)).limit(1);
    await notifyPendingReview({
      kind: params.kind,
      authorName: await getAuthorDisplayName(params.db, params.authorId),
      storyTitle: storyRow?.title ?? "",
      chapterTitle: params.chapterTitle,
      storyId: params.storyId,
    });
  } catch (err) {
    console.error("[stories] pending-review notification failed", params.storyId, err);
  }
}

// Returns false when the story wasn't submitted (forbidden, in the trash,
// database error).
export async function submitStoryForReview(storyId: string, storySlug: string): Promise<boolean> {
  const { db, viewer } = await requireViewer();
  try {
    await storiesData.submitStoryForReview(db, viewer, storyId);
  } catch (err) {
    console.error("[stories] submitStoryForReview failed", storyId, err);
    return false;
  }

  const [row] = await db.select({ status: stories.status }).from(stories).where(eq(stories.id, storyId)).limit(1);
  if (row?.status === "pending_review") {
    await pingModerators({ kind: "story", db, authorId: viewer.id, storyId });
  }

  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
  revalidatePath(ROUTES.home);
  return true;
}

// Author-only soft delete — moves the story to the admin trash instead of
// removing it outright. Flipping status to 'draft' alongside deleted_at
// means every existing status='published' filter across the app already
// stops surfacing it for free, and if staff later restores it
// (deleted_at -> null), it's already sitting in drafts for the author to
// review and republish themselves. Redirects on success; returns false when
// nothing was deleted so the confirm dialog can say so.
export async function deleteStory(storyId: string, storySlug: string): Promise<false> {
  const { db, viewer } = await requireViewer();
  try {
    await storiesData.deleteStory(db, viewer, storyId);
  } catch (err) {
    console.error("[stories] deleteStory failed", storyId, err);
    return false;
  }

  updateTag("stories");
  revalidatePath(ROUTES.story(storySlug));
  revalidatePath(ROUTES.home);
  revalidatePath(ROUTES.search);
  redirect(ROUTES.library);
}

// "subscription": refused because publishing needs a subscription now.
export async function submitChapterForReview(
  chapterId: string,
  storyId: string,
  storySlug: string
): Promise<boolean | "subscription"> {
  const { db, viewer } = await requireViewer();
  if (!(await canPublishNow(db, viewer))) return "subscription";
  try {
    await chaptersData.submitChapterForReview(db, viewer, chapterId);
  } catch (err) {
    console.error("[stories] submitChapterForReview failed", chapterId, err);
    return false;
  }

  const [row] = await db
    .select({ status: chapters.status, title: chapters.title })
    .from(chapters)
    .where(eq(chapters.id, chapterId))
    .limit(1);
  if (row?.status === "pending_review") {
    await pingModerators({ kind: "chapter", db, authorId: viewer.id, storyId, chapterTitle: row.title });
  }

  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
  return true;
}
