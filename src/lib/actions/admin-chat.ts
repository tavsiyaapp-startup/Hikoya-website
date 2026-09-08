"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/actions/create-notification";
import { ROUTES } from "@/lib/constants";

async function isStaff(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return data ? ["admin", "moderator"].includes(data.role) : false;
}

// One shared thread per user (admin_chat_messages.user_id), not one per
// staff member — whoever's staff can send here, and it's the same
// conversation regardless of which admin replies. A regular user may only
// send into their own thread. Both tables are written on the service-role
// client (see migration 0045) — a plain client only ever has SELECT.
export async function sendAdminChatMessage(targetUserId: string, text: string, path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const trimmed = text.trim();
  if (!trimmed) return;

  const staff = await isStaff(supabase, user.id);
  if (!staff && user.id !== targetUserId) return;

  const admin = createAdminClient();
  await admin.from("admin_chat_messages").insert({
    user_id: targetUserId,
    sender_id: user.id,
    is_admin: staff,
    text: trimmed,
  });
  await admin.from("admin_chats").upsert(
    {
      user_id: targetUserId,
      last_message_at: new Date().toISOString(),
      last_message_preview: trimmed.slice(0, 140),
      last_sender_is_admin: staff,
      unread_by_admin: !staff,
      unread_by_user: staff,
    },
    { onConflict: "user_id" }
  );

  // No actor_id — same anonymity as story_approved/story_rejected, the
  // recipient sees "support replied", not which specific admin did.
  if (staff) {
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

export async function markAdminChatReadByAdmin(targetUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  if (!(await isStaff(supabase, user.id))) return;

  const admin = createAdminClient();
  await admin.from("admin_chats").update({ unread_by_admin: false }).eq("user_id", targetUserId);
}
