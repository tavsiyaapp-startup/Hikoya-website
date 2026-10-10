import "server-only";
import { desc, eq, count } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { adminChatMessages, adminChats, profiles } from "@/server/db/schema";
import type { AdminChatMessage, AdminChatSummary } from "@/types/database";

export type ChatMessageWithSender = AdminChatMessage & {
  sender: { display_name: string; avatar_url: string | null } | null;
};

function toMessage(row: typeof adminChatMessages.$inferSelect): AdminChatMessage {
  return { ...row, created_at: row.created_at.toISOString() };
}

function toSummary(row: typeof adminChats.$inferSelect): AdminChatSummary {
  return { ...row, last_message_at: row.last_message_at.toISOString() };
}

// Used by both /chat (the user's own thread) and /admin/chats (any staff
// member's view of a given user's thread) — who may call this with which
// userId is enforced by the caller (src/lib/actions/admin-chat.ts and the
// page components), not by a database policy anymore.
export async function getAdminChatMessages(userId: string, limit = 300): Promise<ChatMessageWithSender[]> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        message: adminChatMessages,
        sender: { display_name: profiles.display_name, avatar_url: profiles.avatar_url },
      })
      .from(adminChatMessages)
      .innerJoin(profiles, eq(adminChatMessages.sender_id, profiles.id))
      .where(eq(adminChatMessages.user_id, userId))
      .orderBy(adminChatMessages.created_at)
      .limit(limit);
    return rows.map((r) => ({ ...toMessage(r.message), sender: r.sender }));
  } catch {
    return [];
  }
}

export async function getAdminChatSummary(userId: string): Promise<AdminChatSummary | null> {
  try {
    const db = getDb();
    const [row] = await db.select().from(adminChats).where(eq(adminChats.user_id, userId)).limit(1);
    return row ? toSummary(row) : null;
  } catch {
    return null;
  }
}

export type AdminChatListItem = AdminChatSummary & {
  user: { display_name: string; username: string; avatar_url: string | null } | null;
};

// Admin-only — every user who has ever exchanged a message with support,
// most recently active first. Staff-only gating happens at the call site
// (src/app/admin/...), the same as every other admin query.
export async function getAdminChatsList(): Promise<AdminChatListItem[]> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        chat: adminChats,
        user: { display_name: profiles.display_name, username: profiles.username, avatar_url: profiles.avatar_url },
      })
      .from(adminChats)
      .innerJoin(profiles, eq(adminChats.user_id, profiles.id))
      .orderBy(desc(adminChats.last_message_at));
    return rows.map((r) => ({ ...toSummary(r.chat), user: r.user }));
  } catch {
    return [];
  }
}

// Resolves the target user's identity when a staff member opens a brand
// new conversation (no admin_chats row exists yet — that only gets created
// once the first message actually gets sent).
export async function getProfileForChat(
  userId: string
): Promise<{ display_name: string; username: string; avatar_url: string | null } | null> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ display_name: profiles.display_name, username: profiles.username, avatar_url: profiles.avatar_url })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

export async function getUnreadAdminChatsCount(): Promise<number> {
  try {
    const db = getDb();
    const [{ total }] = await db.select({ total: count() }).from(adminChats).where(eq(adminChats.unread_by_admin, true));
    return total;
  } catch {
    return 0;
  }
}
