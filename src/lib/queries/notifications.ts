import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/types/database";

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export type NotificationWithContext = Notification & {
  actor: { display_name: string } | null;
  story: { title: string; slug: string } | null;
  chapter: { order_index: number; title: string } | null;
};

export async function getNotifications(userId: string, limit = 40): Promise<NotificationWithContext[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("notifications")
      .select(
        "*, actor:profiles!notifications_actor_id_fkey(display_name), story:stories(title, slug), chapter:chapters(order_index, title)"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data as NotificationWithContext[]) ?? [];
  } catch {
    return [];
  }
}
