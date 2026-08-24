"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

export async function updateStoryStatusAdmin(storyId: string, status: "draft" | "published" | "unlisted") {
  await requireStaff();
  const admin = createAdminClient();
  await admin.from("stories").update({ status }).eq("id", storyId);
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

  revalidatePath(`${ROUTES.admin}/settings`);
}
