"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/actions/create-notification";
import { ROUTES } from "@/lib/constants";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "moderator"].includes(profile.role)) redirect(ROUTES.home);
  return user;
}

// Stricter than requireStaff() — moderators have every admin-panel
// capability except this one: only a real admin can hand out moderator
// accounts (or promote/demote anyone) to other people.
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") redirect(ROUTES.home);
}

export async function updateUserRole(userId: string, role: "reader" | "author" | "moderator" | "admin") {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("profiles").update({ role }).eq("id", userId);
  revalidatePath(`${ROUTES.admin}/users`);
}

export async function approveStory(storyId: string, storySlug: string) {
  await requireStaff();
  const admin = createAdminClient();
  const { data: story } = await admin
    .from("stories")
    .update({ status: "published", published_at: new Date().toISOString(), rejection_reason: null })
    .eq("id", storyId)
    .select("author_id")
    .single();
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
  const admin = createAdminClient();
  const { data: story } = await admin
    .from("stories")
    .update({ status: "draft", rejection_reason: reason })
    .eq("id", storyId)
    .select("author_id")
    .single();
  if (story) {
    await createNotification({ userId: story.author_id, type: "story_rejected", storyId, message: reason });
  }
  updateTag("stories");
  revalidatePath(ROUTES.manage(storySlug));
  revalidatePath(ROUTES.story(storySlug));
  revalidatePath(`${ROUTES.admin}/stories`);
  revalidatePath(ROUTES.adminStory(storyId));
  revalidatePath(ROUTES.admin);
}

// Same status/reason fields as rejectStory, applied to an already-live
// story instead of a pending submission — staff can only take a published
// story off public view, never delete it (RLS blocks that outright, see
// migration 0027). Distinct notification type from story_rejected so the
// author isn't told a live story was "rejected".
export async function hideStory(storyId: string, storySlug: string, reason: string) {
  await requireStaff();
  const admin = createAdminClient();
  const { data: story } = await admin
    .from("stories")
    .update({ status: "draft", rejection_reason: reason })
    .eq("id", storyId)
    .select("author_id")
    .single();
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
  const admin = createAdminClient();
  const { data: story } = await admin
    .from("stories")
    .update({ deleted_at: null })
    .eq("id", storyId)
    .select("author_id")
    .single();
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

  await admin.from("stories").delete().eq("id", storyId).not("deleted_at", "is", null);

  revalidatePath(`${ROUTES.admin}/stories`);
  revalidatePath(ROUTES.admin);
}

export async function approveChapter(chapterId: string, storyId: string, storySlug: string) {
  await requireStaff();
  const admin = createAdminClient();
  await admin
    .from("chapters")
    .update({ status: "published", published_at: new Date().toISOString(), rejection_reason: null })
    .eq("id", chapterId)
    .eq("story_id", storyId);
  const { data: story } = await admin.from("stories").select("author_id").eq("id", storyId).single();
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
  const admin = createAdminClient();
  await admin
    .from("chapters")
    .update({ status: "draft", rejection_reason: reason })
    .eq("id", chapterId)
    .eq("story_id", storyId);
  const { data: story } = await admin.from("stories").select("author_id").eq("id", storyId).single();
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
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ status: currentStatus === "active" ? "blocked" : "active" })
    .eq("id", userId);
  revalidatePath(`${ROUTES.admin}/users`);
  revalidatePath(ROUTES.admin);
}

export async function toggleUserVerified(userId: string, verified: boolean) {
  await requireStaff();
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .update({ is_verified: verified })
    .eq("id", userId)
    .select("username")
    .single();
  revalidatePath(`${ROUTES.admin}/users`);
  if (data?.username) revalidatePath(ROUTES.author(data.username));
}

// The toggle UI always reflects the current DB state, so "turn on" only
// ever fires when no row exists yet (plain insert, no upsert needed) and
// "turn off" only when one does.
export async function toggleFeaturedStory(storyId: string, tier: "day" | "week" | "month", featured: boolean) {
  await requireStaff();
  const admin = createAdminClient();
  if (featured) {
    await admin.from("featured_stories").insert({ story_id: storyId, tier });
  } else {
    await admin.from("featured_stories").delete().eq("story_id", storyId).eq("tier", tier);
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
  const admin = createAdminClient();
  const fields = readHeroSlideFields(formData);
  if (!fields.image_url && !fields.title_ru && !fields.title_uz && !fields.body_ru && !fields.body_uz) return;

  await admin.from("hero_slides").insert(fields);

  updateTag("hero-slides");
  revalidatePath(`${ROUTES.admin}/banner`);
  revalidatePath(ROUTES.home);
}

export async function updateHeroSlide(slideId: string, formData: FormData) {
  await requireStaff();
  const admin = createAdminClient();
  const fields = readHeroSlideFields(formData);
  if (!fields.image_url && !fields.title_ru && !fields.title_uz && !fields.body_ru && !fields.body_uz) return;

  await admin.from("hero_slides").update(fields).eq("id", slideId);

  updateTag("hero-slides");
  revalidatePath(`${ROUTES.admin}/banner`);
  revalidatePath(ROUTES.home);
}

export async function deleteHeroSlide(slideId: string) {
  await requireStaff();
  const admin = createAdminClient();
  const { count } = await admin.from("hero_slides").select("*", { count: "exact", head: true });
  if ((count ?? 0) <= 1) return;
  await admin.from("hero_slides").delete().eq("id", slideId);
  updateTag("hero-slides");
  revalidatePath(`${ROUTES.admin}/banner`);
  revalidatePath(ROUTES.home);
}

// Replace-all, same pattern as updateCollectionAdmin's collection_items —
// simplest correct way to sync a set from a checkbox list with no ordering.
export async function updateUserAchievements(userId: string, achievementIds: string[]) {
  await requireStaff();
  const admin = createAdminClient();
  await admin.from("user_achievements").delete().eq("user_id", userId);
  if (achievementIds.length > 0) {
    await admin
      .from("user_achievements")
      .insert(achievementIds.map((achievementId) => ({ user_id: userId, achievement_id: achievementId })));
  }
  const { data } = await admin.from("profiles").select("username").eq("id", userId).single();
  revalidatePath(`${ROUTES.admin}/users`);
  if (data?.username) revalidatePath(ROUTES.author(data.username));
}

export async function setRequestStatusAdmin(requestId: string, status: "open" | "closed") {
  await requireStaff();
  const admin = createAdminClient();
  await admin.from("requests").update({ status }).eq("id", requestId);
  revalidatePath(`${ROUTES.admin}/requests`);
  revalidatePath(ROUTES.board);
}

export async function deleteRequestAdmin(requestId: string) {
  await requireStaff();
  const admin = createAdminClient();
  await admin.from("requests").delete().eq("id", requestId);
  revalidatePath(`${ROUTES.admin}/requests`);
  revalidatePath(ROUTES.board);
}

export async function updateStoryStatusAdmin(storyId: string, status: "draft" | "published" | "unlisted") {
  await requireStaff();
  const admin = createAdminClient();
  await admin.from("stories").update({ status }).eq("id", storyId);
  updateTag("stories");
  revalidatePath(`${ROUTES.admin}/stories`);
}

export async function updatePlatformSettings(formData: FormData) {
  await requireStaff();
  const admin = createAdminClient();

  const guestFreeChapters = Number(formData.get("guestFreeChapters") ?? 1);
  const commentsRequireApproval = formData.get("commentsRequireApproval") === "on";
  const newStoryRequiresReview = formData.get("newStoryRequiresReview") === "on";

  await admin
    .from("platform_settings")
    .update({
      guest_free_chapters: guestFreeChapters,
      comments_require_approval: commentsRequireApproval,
      new_story_requires_review: newStoryRequiresReview,
    })
    .eq("id", 1);

  updateTag("settings");
  revalidatePath(`${ROUTES.admin}/settings`);
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

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  });
  if (error || !data.user) {
    // Doesn't touch the existing account — Supabase just refuses the
    // duplicate email outright. Point the admin at the right tool instead
    // (promote the existing account's role on /admin/users) rather than a
    // generic failure message.
    if (error?.code === "email_exists") return { error: "email_exists" };
    return { error: "unknown" };
  }

  // on_auth_user_created stubs a profiles row (role defaults to 'reader')
  // for every new auth.users insert, including this admin-created one —
  // promote it to moderator right after.
  await admin.from("profiles").update({ role: "moderator" }).eq("id", data.user.id);

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
  const user = await requireStaff();
  const admin = createAdminClient();
  const { title, description, isFeatured, storyIds } = collectionInputFromForm(formData);
  if (!title) return;

  const { data: collection, error } = await admin
    .from("collections")
    .insert({
      owner_id: user.id,
      owner_type: "moderator",
      title,
      description: description || null,
      is_featured: isFeatured,
    })
    .select("id")
    .single();
  if (error || !collection) return;

  if (storyIds.length > 0) {
    await admin
      .from("collection_items")
      .insert(storyIds.map((storyId, i) => ({ collection_id: collection.id, story_id: storyId, position: i })));
  }

  updateTag("collections");
  revalidatePath(`${ROUTES.admin}/collections`);
  revalidatePath(ROUTES.collections);
  revalidatePath(ROUTES.home);
  redirect(`${ROUTES.admin}/collections`);
}

export async function updateCollectionAdmin(collectionId: string, formData: FormData) {
  await requireStaff();
  const admin = createAdminClient();
  const { title, description, isFeatured, storyIds } = collectionInputFromForm(formData);
  if (!title) return;

  await admin
    .from("collections")
    .update({ title, description: description || null, is_featured: isFeatured })
    .eq("id", collectionId);

  await admin.from("collection_items").delete().eq("collection_id", collectionId);
  if (storyIds.length > 0) {
    await admin
      .from("collection_items")
      .insert(storyIds.map((storyId, i) => ({ collection_id: collectionId, story_id: storyId, position: i })));
  }

  updateTag("collections");
  revalidatePath(`${ROUTES.admin}/collections`);
  revalidatePath(ROUTES.collection(collectionId));
  revalidatePath(ROUTES.collections);
  redirect(`${ROUTES.admin}/collections`);
}

export async function deleteCollectionAdmin(collectionId: string) {
  await requireStaff();
  const admin = createAdminClient();
  await admin.from("collections").delete().eq("id", collectionId);
  updateTag("collections");
  revalidatePath(`${ROUTES.admin}/collections`);
  revalidatePath(ROUTES.collections);
}
