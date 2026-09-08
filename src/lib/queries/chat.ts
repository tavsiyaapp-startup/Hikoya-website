import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AdminChatMessage, AdminChatSummary } from "@/types/database";

export type ChatMessageWithSender = AdminChatMessage & {
  sender: { display_name: string; avatar_url: string | null } | null;
};

// Used by both /chat (the user's own thread) and /admin/chats (any staff
// member's view of a given user's thread) — RLS (user_id = auth.uid() or
// is_staff()) is what actually enforces who may read what here.
export async function getAdminChatMessages(userId: string, limit = 300): Promise<ChatMessageWithSender[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("admin_chat_messages")
      .select("*, sender:profiles!admin_chat_messages_sender_id_fkey(display_name, avatar_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(limit);
    return (data as ChatMessageWithSender[]) ?? [];
  } catch {
    return [];
  }
}

export async function getAdminChatSummary(userId: string): Promise<AdminChatSummary | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("admin_chats").select("*").eq("user_id", userId).maybeSingle();
    return (data as AdminChatSummary) ?? null;
  } catch {
    return null;
  }
}

export type AdminChatListItem = AdminChatSummary & {
  user: { display_name: string; username: string; avatar_url: string | null } | null;
};

// Admin-only (RLS: is_staff()) — every user who has ever exchanged a
// message with support, most recently active first.
export async function getAdminChatsList(): Promise<AdminChatListItem[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("admin_chats")
      .select("*, user:profiles!admin_chats_user_id_fkey(display_name, username, avatar_url)")
      .order("last_message_at", { ascending: false });
    return (data as AdminChatListItem[]) ?? [];
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
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("display_name, username, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export async function getUnreadAdminChatsCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("admin_chats")
      .select("user_id", { count: "exact", head: true })
      .eq("unread_by_admin", true);
    return count ?? 0;
  } catch {
    return 0;
  }
}
