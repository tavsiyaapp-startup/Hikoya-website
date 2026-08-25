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
}

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

export async function resolveReport(reportId: string, status: "reviewed" | "resolved") {
  await requireStaff();
  const admin = createAdminClient();
  await admin.from("reports").update({ status }).eq("id", reportId);
  revalidatePath(`${ROUTES.admin}/reports`);
  revalidatePath(ROUTES.admin);
}

export async function deleteReport(reportId: string) {
  await requireStaff();
  const admin = createAdminClient();
  await admin.from("reports").delete().eq("id", reportId);
  revalidatePath(`${ROUTES.admin}/reports`);
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
