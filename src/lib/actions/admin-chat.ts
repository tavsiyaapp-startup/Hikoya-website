"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/actions/create-notification";
import { ROUTES } from "@/lib/constants";
import { getStaffSession } from "@/server/auth/staff";

async function isStaff(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return data ? ["admin", "moderator"].includes(data.role) : false;
}

// Resolves who's sending. A staff reply from /admin is gated by Better
// Auth now (Phase 1 of the Supabase exit, see src/server/auth/staff.ts)
// — a genuine admin-UI call always has one of these sessions, checked
// first. A regular user writing into their own thread from the public
// /chat page (still entirely Supabase-based) falls through to the
// original check below, unchanged.
async function resolveSender(): Promise<{ userId: string; isStaff: boolean } | null> {
  const staffResult = await getStaffSession();
  if (staffResult.status === "staff") return { userId: staffResult.staff.id, isStaff: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { userId: user.id, isStaff: await isStaff(supabase, user.id) };
}

// One shared thread per user (admin_chat_messages.user_id), not one per
// staff member — whoever's staff can send here, and it's the same
// conversation regardless of which admin replies. A regular user may only
// send into their own thread. Both tables are written on the service-role
// client (see migration 0045) — a plain client only ever has SELECT.
export async function sendAdminChatMessage(targetUserId: string, text: string, path: string) {
  const sender = await resolveSender();
  if (!sender) redirect(ROUTES.onboarding);

  const trimmed = text.trim();
  if (!trimmed) return;

  if (!sender.isStaff && sender.userId !== targetUserId) return;

  const admin = createAdminClient();
  await admin.from("admin_chat_messages").insert({
    user_id: targetUserId,
    sender_id: sender.userId,
    is_admin: sender.isStaff,
    text: trimmed,
  });
  await admin.from("admin_chats").upsert(
    {
      user_id: targetUserId,
      last_message_at: new Date().toISOString(),
      last_message_preview: trimmed.slice(0, 140),
      last_sender_is_admin: sender.isStaff,
      unread_by_admin: !sender.isStaff,
      unread_by_user: sender.isStaff,
    },
    { onConflict: "user_id" }
  );

  // No actor_id — same anonymity as story_approved/story_rejected, the
  // recipient sees "support replied", not which specific admin did.
  if (sender.isStaff) {
    await createNotification({ userId: targetUserId, type: "admin_message" });
  }

  revalidatePath(path);
}

export async function markAdminChatReadByUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  await admin.from("admin_chats").update({ unread_by_user: false }).eq("user_id", user.id);
}

// Staff-only — called from /admin, so a valid Better Auth staff session is
// already guaranteed by the layout/middleware gate by the time this runs.
export async function markAdminChatReadByAdmin(targetUserId: string) {
  const result = await getStaffSession();
  if (result.status !== "staff") return;

  const admin = createAdminClient();
  await admin.from("admin_chats").update({ unread_by_admin: false }).eq("user_id", targetUserId);
}
