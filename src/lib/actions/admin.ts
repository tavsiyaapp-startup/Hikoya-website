"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  announcements,
  chapters,
  collectionItems,
  collections,
  featuredStories,
  heroSlides,
  likes,
  platformSettings,
  profiles,
  requests,
  stories,
  userAchievements,
} from "@/server/db/schema";
import { setCredentialPassword } from "@/server/auth/set-password";
import { createNotification } from "@/lib/actions/create-notification";
import { ROUTES } from "@/lib/constants";
import { getStaffSession } from "@/server/auth/staff";

// Identity comes from Better Auth (Phase 1 of the Supabase exit, see
// src/server/auth/staff.ts). The writes below used to go through
// createAdminClient() (Supabase's service-role client, bypassing RLS) —
// moved onto Drizzle/pg directly (Phase 2) since Supabase itself is
// currently unreachable (egress quota), so every one of these was failing
// outright regardless of RLS. Behavior/signatures kept identical so none
// of the calling admin pages needed touching. Zero Supabase dependency
// left in this file — the one piece that used to also delete the old
// image from Supabase Storage (deleteHeroSlide/deleteAnnouncement) now
// just leaves it orphaned there instead; file storage isn't migrated yet,
// that's its own separate, still-pending piece.
async function requireStaff() {
  const result = await getStaffSession();
  if (result.status === "signed-out") redirect(ROUTES.onboarding);
  if (result.status === "not-staff") redirect(ROUTES.home);
  return result.staff;
}

// Stricter than requireStaff() — moderators have every admin-panel
// capability except this one: only a real admin can hand out moderator
// accounts (or promote/demote anyone) to other people.
async function requireAdmin() {
  const result = await getStaffSession();
  if (result.status === "signed-out") redirect(ROUTES.onboarding);
  if (result.status === "not-staff" || !result.staff.isAdmin) redirect(ROUTES.home);
}

export async function updateUserRole(userId: string, role: "reader" | "author" | "moderator" | "admin") {
  await requireAdmin();
  const db = getDb();
  await db.update(profiles).set({ role }).where(eq(profiles.id, userId));
  revalidatePath(`${ROUTES.admin}/users`);
}

export async function approveStory(storyId: string, storySlug: string) {
  await requireStaff();
  const db = getDb();
  const [story] = await db
    .update(stories)
    .set({ status: "published", published_at: new Date(), rejection_reason: null })
    .where(eq(stories.id, storyId))
    .returning({ author_id: stories.author_id });
  if (story) {
    await createNotification({ userId: story.author_id, type: "story_approved", storyId });
  }
  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
  revalidatePath(`${ROUTES.admin}/stories`);
  revalidatePath(ROUTES.adminStory(storyId));
  revalidatePath(ROUTES.admin);
  revalidatePath(ROUTES.home);
}

export async function rejectStory(storyId: string, storySlug: string, reason: string) {
  await requireStaff();
  const db = getDb();
  const [story] = await db
    .update(stories)
    .set({ status: "draft", rejection_reason: reason })
    .where(eq(stories.id, storyId))
    .returning({ author_id: stories.author_id });
  if (story) {
    await createNotification({ userId: story.author_id, type: "story_rejected", storyId, message: reason });
  }
  // Rejecting the story's own pending submission drags its still-pending
  // chapters back to draft too — otherwise they'd be stuck at
  // pending_review forever with no way back in, and keep resurfacing the
  // rejected story in the moderation queue via getAllStoriesAdmin's
  // "has a pending chapter" fallback. Scoped to pending_review only so this
  // never touches a chapter that's individually pending review on an
  // already-published story (rejectChapter below is the one-chapter path
  // for that case, untouched by this).
  await db
    .update(chapters)
    .set({ status: "draft", rejection_reason: reason })
    .where(and(eq(chapters.story_id, storyId), eq(chapters.status, "pending_review")));
  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
  revalidatePath(`${ROUTES.admin}/stories`);
  revalidatePath(ROUTES.adminStory(storyId));
  revalidatePath(ROUTES.admin);
}

// Same status/reason fields as rejectStory, applied to an already-live
// story instead of a pending submission — staff can only take a published
// story off public view, never delete it (RLS used to block that outright,
// see migration 0027 — now this is simply the only code path that exists).
// Distinct notification type from story_rejected so the author isn't told
// a live story was "rejected".
export async function hideStory(storyId: string, storySlug: string, reason: string) {
  await requireStaff();
  const db = getDb();
  const [story] = await db
    .update(stories)
    .set({ status: "draft", rejection_reason: reason })
    .where(eq(stories.id, storyId))
    .returning({ author_id: stories.author_id });
  if (story) {
    await createNotification({ userId: story.author_id, type: "story_hidden", storyId, message: reason });
  }
  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
  revalidatePath(`${ROUTES.admin}/stories`);
  revalidatePath(ROUTES.adminStory(storyId));
  revalidatePath(ROUTES.admin);
  revalidatePath(ROUTES.home);
  revalidatePath(ROUTES.search);
}

// Trash (deleted_at set by the author's own soft-delete, see deleteStory in
// stories.ts). Restoring just clears deleted_at — status is already 'draft'
// from the moment the author deleted it, so this drops the story straight
// back into their normal drafts list with nothing else to reconcile.
export async function restoreStory(storyId: string, storySlug: string) {
  await requireStaff();
  const db = getDb();
  const [story] = await db
    .update(stories)
    .set({ deleted_at: null })
    .where(eq(stories.id, storyId))
    .returning({ author_id: stories.author_id });
  if (story) {
    await createNotification({ userId: story.author_id, type: "story_restored", storyId });
  }
  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(`${ROUTES.admin}/stories`);
  revalidatePath(ROUTES.adminStory(storyId));
  revalidatePath(ROUTES.admin);
}

// Irreversible — only ever reachable from the trash UI (deleted_at already
// set), and the deleted_at check below is a second guard against that
// UI-only gating. Mirrors the cleanup the old author-side hard-delete used
// to do (likes is polymorphic — target_type/target_id, no FK — so cascade
// doesn't reach it); chapters/comments/bookmarks/reading_statuses/
// story_tags/collection_items/featured_stories all cascade on their own.
export async function permanentlyDeleteStory(storyId: string) {
  await requireStaff();
  const db = getDb();

  const chapterRows = await db.select({ id: chapters.id }).from(chapters).where(eq(chapters.story_id, storyId));
  const chapterIds = chapterRows.map((c) => c.id);

  await db.delete(likes).where(and(eq(likes.target_type, "story"), eq(likes.target_id, storyId)));
  if (chapterIds.length > 0) {
    await db.delete(likes).where(and(eq(likes.target_type, "chapter"), inArray(likes.target_id, chapterIds)));
  }
  // Comment likes cascade with the comments themselves (deleted below via
  // the story's own cascade), so unlike chapters there's no separate
  // comment-id lookup needed here — only story/chapter likes are
  // polymorphic references the stories.id cascade can't reach on its own.

  await db.delete(stories).where(and(eq(stories.id, storyId), isNotNull(stories.deleted_at)));

  revalidatePath(`${ROUTES.admin}/stories`);
  revalidatePath(ROUTES.admin);
}

export async function approveChapter(chapterId: string, storyId: string, storySlug: string) {
  await requireStaff();
  const db = getDb();
  await db
    .update(chapters)
    .set({ status: "published", published_at: new Date(), rejection_reason: null })
    .where(and(eq(chapters.id, chapterId), eq(chapters.story_id, storyId)));
  const [story] = await db.select({ author_id: stories.author_id }).from(stories).where(eq(stories.id, storyId)).limit(1);
  if (story) {
    await createNotification({ userId: story.author_id, type: "chapter_approved", storyId, chapterId });
  }
  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
  revalidatePath(ROUTES.adminStory(storyId));
  revalidatePath(ROUTES.adminChapter(storyId, chapterId));
}

export async function rejectChapter(chapterId: string, storyId: string, storySlug: string, reason: string) {
  await requireStaff();
  const db = getDb();
  await db
    .update(chapters)
    .set({ status: "draft", rejection_reason: reason })
    .where(and(eq(chapters.id, chapterId), eq(chapters.story_id, storyId)));
  const [story] = await db.select({ author_id: stories.author_id }).from(stories).where(eq(stories.id, storyId)).limit(1);
  if (story) {
    await createNotification({
      userId: story.author_id,
      type: "chapter_rejected",
      storyId,
      chapterId,
      message: reason,
    });
  }
  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
  revalidatePath(ROUTES.adminStory(storyId));
  revalidatePath(ROUTES.adminChapter(storyId, chapterId));
}

export async function toggleUserStatus(userId: string, currentStatus: string) {
  await requireStaff();
  const db = getDb();
  await db
    .update(profiles)
    .set({ status: currentStatus === "active" ? "blocked" : "active" })
    .where(eq(profiles.id, userId));
  revalidatePath(`${ROUTES.admin}/users`);
  revalidatePath(ROUTES.admin);
}

export async function toggleUserVerified(userId: string, verified: boolean) {
  await requireStaff();
  const db = getDb();
  const [data] = await db
    .update(profiles)
    .set({ is_verified: verified })
    .where(eq(profiles.id, userId))
    .returning({ username: profiles.username });
  revalidatePath(`${ROUTES.admin}/users`);
  if (data?.username) revalidatePath(ROUTES.author(data.username));
}

// The toggle UI always reflects the current DB state, so "turn on" only
// ever fires when no row exists yet (plain insert, no upsert needed) and
// "turn off" only when one does.
export async function toggleFeaturedStory(storyId: string, tier: "day" | "week" | "month", featured: boolean) {
  await requireStaff();
  const db = getDb();
  if (featured) {
    await db.insert(featuredStories).values({ story_id: storyId, tier });
  } else {
    await db.delete(featuredStories).where(and(eq(featuredStories.story_id, storyId), eq(featuredStories.tier, tier)));
  }
  updateTag("stories");
  revalidatePath(`${ROUTES.admin}/featured`);
  revalidatePath(ROUTES.home);
  revalidatePath(ROUTES.search);
}

function readHeroSlideFields(formData: FormData) {
  const titleRu = String(formData.get("titleRu") ?? "").trim();
  const titleUz = String(formData.get("titleUz") ?? "").trim();
  const bodyRu = String(formData.get("bodyRu") ?? "").trim();
  const bodyUz = String(formData.get("bodyUz") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const imageUrlMobile = String(formData.get("imageUrlMobile") ?? "").trim();
  const ctaLabelRu = String(formData.get("ctaLabelRu") ?? "").trim();
  const ctaLabelUz = String(formData.get("ctaLabelUz") ?? "").trim();
  const ctaUrl = String(formData.get("ctaUrl") ?? "").trim();
  return {
    title_ru: titleRu || null,
    title_uz: titleUz || null,
    body_ru: bodyRu || null,
    body_uz: bodyUz || null,
    image_url: imageUrl || null,
    image_url_mobile: imageUrlMobile || null,
    cta_label_ru: ctaLabelRu || null,
    cta_label_uz: ctaLabelUz || null,
    cta_url: ctaUrl || null,
  };
}

export async function createHeroSlide(formData: FormData) {
  await requireStaff();
  const db = getDb();
  const fields = readHeroSlideFields(formData);
  if (!fields.image_url && !fields.title_ru && !fields.title_uz && !fields.body_ru && !fields.body_uz) return;

  await db.insert(heroSlides).values(fields);

  updateTag("hero-slides");
  revalidatePath(`${ROUTES.admin}/banner`);
  revalidatePath(ROUTES.home);
}

export async function updateHeroSlide(slideId: string, formData: FormData) {
  await requireStaff();
  const db = getDb();
  const fields = readHeroSlideFields(formData);
  if (!fields.image_url && !fields.title_ru && !fields.title_uz && !fields.body_ru && !fields.body_uz) return;

  await db.update(heroSlides).set(fields).where(eq(heroSlides.id, slideId));

  updateTag("hero-slides");
  revalidatePath(`${ROUTES.admin}/banner`);
  revalidatePath(ROUTES.home);
}

export async function deleteHeroSlide(slideId: string) {
  await requireStaff();
  const db = getDb();
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(heroSlides);
  if (total <= 1) return;
  // Used to also delete the slide's image(s) from Supabase Storage here —
  // dropped along with every other Supabase dependency in this file; file
  // storage isn't migrated yet (still a separate, pending piece), so this
  // now just leaves an orphaned file in Storage instead of depending on a
  // service that's currently unreachable anyway.
  await db.delete(heroSlides).where(eq(heroSlides.id, slideId));
  updateTag("hero-slides");
  revalidatePath(`${ROUTES.admin}/banner`);
  revalidatePath(ROUTES.home);
}

function readAnnouncementFields(formData: FormData) {
  const textRu = String(formData.get("textRu") ?? "").trim();
  const textUz = String(formData.get("textUz") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const linkUrl = String(formData.get("linkUrl") ?? "").trim();
  return {
    text_ru: textRu || null,
    text_uz: textUz || null,
    image_url: imageUrl || null,
    link_url: linkUrl || null,
  };
}

export async function createAnnouncement(formData: FormData) {
  await requireStaff();
  const db = getDb();
  const fields = readAnnouncementFields(formData);
  if (!fields.image_url && !fields.text_ru && !fields.text_uz) return;

  await db.insert(announcements).values(fields);

  updateTag("announcements");
  revalidatePath(`${ROUTES.admin}/announcements`);
  revalidatePath(ROUTES.home);
}

export async function updateAnnouncement(announcementId: string, formData: FormData) {
  await requireStaff();
  const db = getDb();
  const fields = readAnnouncementFields(formData);
  if (!fields.image_url && !fields.text_ru && !fields.text_uz) return;

  await db.update(announcements).set(fields).where(eq(announcements.id, announcementId));

  updateTag("announcements");
  revalidatePath(`${ROUTES.admin}/announcements`);
  revalidatePath(ROUTES.home);
}

export async function deleteAnnouncement(announcementId: string) {
  await requireStaff();
  const db = getDb();
  // Same as deleteHeroSlide above — no more Supabase Storage cleanup here.
  await db.delete(announcements).where(eq(announcements.id, announcementId));
  updateTag("announcements");
  revalidatePath(`${ROUTES.admin}/announcements`);
  revalidatePath(ROUTES.home);
}

// Replace-all, same pattern as updateCollectionAdmin's collection_items —
// simplest correct way to sync a set from a checkbox list with no ordering.
export async function updateUserAchievements(userId: string, achievementIds: string[]) {
  await requireStaff();
  const db = getDb();
  await db.delete(userAchievements).where(eq(userAchievements.user_id, userId));
  if (achievementIds.length > 0) {
    await db
      .insert(userAchievements)
      .values(achievementIds.map((achievementId) => ({ user_id: userId, achievement_id: achievementId })));
  }
  const [data] = await db.select({ username: profiles.username }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  revalidatePath(`${ROUTES.admin}/users`);
  if (data?.username) revalidatePath(ROUTES.author(data.username));
}

export async function setRequestStatusAdmin(requestId: string, status: "open" | "closed") {
  await requireStaff();
  const db = getDb();
  await db.update(requests).set({ status }).where(eq(requests.id, requestId));
  revalidatePath(`${ROUTES.admin}/requests`);
  revalidatePath(ROUTES.board);
}

export async function deleteRequestAdmin(requestId: string) {
  await requireStaff();
  const db = getDb();
  await db.delete(requests).where(eq(requests.id, requestId));
  revalidatePath(`${ROUTES.admin}/requests`);
  revalidatePath(ROUTES.board);
}

export async function updateStoryStatusAdmin(storyId: string, status: "draft" | "published" | "unlisted") {
  await requireStaff();
  const db = getDb();
  // "unlisted" is a visibility, not a status — matches the original
  // Supabase query, which wrote this same value into the status column
  // under this same name (schema_reference.sql's story_status enum
  // includes it for exactly this admin override).
  await db.update(stories).set({ status }).where(eq(stories.id, storyId));
  updateTag("stories");
  revalidatePath(`${ROUTES.admin}/stories`);
}

export async function updatePlatformSettings(formData: FormData) {
  await requireStaff();
  const db = getDb();

  const guestFreeChapters = Number(formData.get("guestFreeChapters") ?? 1);
  const commentsRequireApproval = formData.get("commentsRequireApproval") === "on";
  const newStoryRequiresReview = formData.get("newStoryRequiresReview") === "on";

  await db
    .update(platformSettings)
    .set({
      guest_free_chapters: guestFreeChapters,
      comments_require_approval: commentsRequireApproval,
      new_story_requires_review: newStoryRequiresReview,
    })
    .where(eq(platformSettings.id, 1));

  updateTag("settings");
  revalidatePath(`${ROUTES.admin}/settings`);
}

// Username generation mirrors supabase/migrations/0005_auth_trigger.sql's
// handle_new_user() — the Postgres trigger that used to run this on every
// new auth.users row, now dead code since Better Auth inserts into
// profiles directly and never touches auth.users. This is the one place
// outside that trigger a brand-new profiles row gets created by hand.
async function uniqueUsernameFromEmail(email: string): Promise<string> {
  const db = getDb();
  const base = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "") || "user";
  let candidate = base;
  let suffix = 0;
  for (;;) {
    const [existing] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, candidate)).limit(1);
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
}

export async function createModerator(
  formData: FormData
): Promise<{ error: "missing_fields" | "password_too_short" | "email_exists" | "unknown" } | { ok: true }> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!email || !password || !displayName) return { error: "missing_fields" };
  if (password.length < 6) return { error: "password_too_short" };

  const db = getDb();
  const [existing] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.email, email.toLowerCase())).limit(1);
  if (existing) return { error: "email_exists" };

  try {
    const userId = crypto.randomUUID();
    const username = await uniqueUsernameFromEmail(email);
    await db.insert(profiles).values({
      id: userId,
      username,
      display_name: displayName,
      role: "moderator",
      email: email.toLowerCase(),
      email_verified: true,
      onboarded_at: new Date(),
      has_password: true,
    });
    await setCredentialPassword(db, userId, password);
  } catch {
    return { error: "unknown" };
  }

  revalidatePath(`${ROUTES.admin}/settings`);
  revalidatePath(`${ROUTES.admin}/users`);
  return { ok: true };
}

function collectionInputFromForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const isFeatured = formData.get("isFeatured") === "on";
  const storyIds = formData.getAll("storyIds").map(String);
  return { title, description, isFeatured, storyIds };
}

export async function createCollectionAdmin(formData: FormData) {
  const staff = await requireStaff();
  const db = getDb();
  const { title, description, isFeatured, storyIds } = collectionInputFromForm(formData);
  if (!title) return;

  const [collection] = await db
    .insert(collections)
    .values({
      owner_id: staff.id,
      owner_type: "moderator",
      title,
      description: description || null,
      is_featured: isFeatured,
    })
    .returning({ id: collections.id });
  if (!collection) return;

  if (storyIds.length > 0) {
    await db
      .insert(collectionItems)
      .values(storyIds.map((storyId, i) => ({ collection_id: collection.id, story_id: storyId, position: i })));
  }

  updateTag("collections");
  revalidatePath(`${ROUTES.admin}/collections`);
  revalidatePath(ROUTES.collections);
  revalidatePath(ROUTES.home);
  redirect(`${ROUTES.admin}/collections`);
}

export async function updateCollectionAdmin(collectionId: string, formData: FormData) {
  await requireStaff();
  const db = getDb();
  const { title, description, isFeatured, storyIds } = collectionInputFromForm(formData);
  if (!title) return;

  await db
    .update(collections)
    .set({ title, description: description || null, is_featured: isFeatured })
    .where(eq(collections.id, collectionId));

  await db.delete(collectionItems).where(eq(collectionItems.collection_id, collectionId));
  if (storyIds.length > 0) {
    await db
      .insert(collectionItems)
      .values(storyIds.map((storyId, i) => ({ collection_id: collectionId, story_id: storyId, position: i })));
  }

  updateTag("collections");
  revalidatePath(`${ROUTES.admin}/collections`);
  revalidatePath(ROUTES.collection(collectionId));
  revalidatePath(ROUTES.collections);
  redirect(`${ROUTES.admin}/collections`);
}

export async function deleteCollectionAdmin(collectionId: string) {
  await requireStaff();
  const db = getDb();
  await db.delete(collections).where(eq(collections.id, collectionId));
  updateTag("collections");
  revalidatePath(`${ROUTES.admin}/collections`);
  revalidatePath(ROUTES.collections);
}
