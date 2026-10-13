"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { adminChatMessages, adminChats } from "@/server/db/schema";
import { createNotification } from "@/lib/actions/create-notification";
import { ROUTES } from "@/lib/constants";
import { getAuth } from "@/server/auth/config";
import { getStaffSession } from "@/server/auth/staff";
import { takeRateLimit } from "@/server/rate-limit";

const MAX_MESSAGE_LENGTH = 4000;
const USER_MESSAGES_PER_10_MIN = 30;

// The public /chat page moved onto Better Auth along with the rest of the
// public login (see src/lib/current-user.ts) — so unlike when this file
// was first converted (Phase 1, staff-only), there's no Supabase fallback
// to fall through to anymore for a regular user either. One session
// source for both.
async function resolveSender(): Promise<{ userId: string; isStaff: boolean } | null> {
  const result = await getStaffSession();
  if (result.status === "staff") return { userId: result.staff.id, isStaff: true };
  if (result.status === "not-staff") {
    // getStaffSession() only tells us "not staff", not who they are —
    // re-read the session for its user id. Small duplicate lookup rather
    // than widening that helper's contract for every other caller.
    const session = await getAuth().api.getSession({ headers: await headers() });
    if (!session) return null;
    return { userId: session.user.id, isStaff: false };
  }
  return null;
}

// One shared thread per user (admin_chat_messages.user_id), not one per
// staff member — whoever's staff can send here, and it's the same
// conversation regardless of which admin replies. A regular user may only
// send into their own thread.
// Returns what happened so the form keeps the typed text when it wasn't
// sent. The page to refresh is decided here from who is sending — the
// client-supplied path is no longer trusted.
export async function sendAdminChatMessage(
  targetUserId: string,
  text: string,
  _path?: string,
): Promise<"sent" | "rate_limited" | "failed"> {
  const sender = await resolveSender();
  if (!sender) redirect(ROUTES.onboarding);

  const trimmed = typeof text === "string" ? text.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
  if (!trimmed) return "failed";

  if (!sender.isStaff && sender.userId !== targetUserId) return "failed";
  if (!sender.isStaff && !takeRateLimit(`support-chat:${sender.userId}`, USER_MESSAGES_PER_10_MIN, 10 * 60 * 1000)) {
    return "rate_limited";
  }

  // Message and thread summary together — written separately, a failure in
  // between left a message the admin chat list never surfaced as unread.
  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(adminChatMessages).values({
        user_id: targetUserId,
        sender_id: sender.userId,
        is_admin: sender.isStaff,
        text: trimmed,
      });
      await tx
        .insert(adminChats)
        .values({
          user_id: targetUserId,
          last_message_at: new Date(),
          last_message_preview: trimmed.slice(0, 140),
          last_sender_is_admin: sender.isStaff,
          unread_by_admin: !sender.isStaff,
          unread_by_user: sender.isStaff,
        })
        .onConflictDoUpdate({
          target: adminChats.user_id,
          set: {
            last_message_at: new Date(),
            last_message_preview: trimmed.slice(0, 140),
            last_sender_is_admin: sender.isStaff,
            unread_by_admin: !sender.isStaff,
            unread_by_user: sender.isStaff,
          },
        });
    });
  } catch (err) {
    console.error("[admin-chat] send failed", targetUserId, err);
    return "failed";
  }

  // No actor_id — same anonymity as story_approved/story_rejected, the
  // recipient sees "support replied", not which specific admin did.
  if (sender.isStaff) {
    await createNotification({ userId: targetUserId, type: "admin_message" });
  }

  revalidatePath(sender.isStaff ? ROUTES.adminChats() : ROUTES.chat);
  return "sent";
}

export async function markAdminChatReadByUser() {
  const sender = await resolveSender();
  if (!sender) return;

  const db = getDb();
  await db.update(adminChats).set({ unread_by_user: false }).where(eq(adminChats.user_id, sender.userId));
}

// Staff-only — called from /admin, so a valid Better Auth staff session is
// already guaranteed by the layout/middleware gate by the time this runs.
export async function markAdminChatReadByAdmin(targetUserId: string) {
  const result = await getStaffSession();
  if (result.status !== "staff") return;

  const db = getDb();
  await db.update(adminChats).set({ unread_by_admin: false }).where(eq(adminChats.user_id, targetUserId));
}
