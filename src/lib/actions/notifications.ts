import "server-only";
import { createClient } from "@/lib/supabase/server";

// Called directly from the notifications page on render (not a "use server"
// action bound to a form/button) — viewing the list is what clears the
// unread badge, matching "collects under the bell until you next check it."
export async function markAllNotificationsRead(userId: string) {
  try {
    const supabase = await createClient();
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
  } catch {
    // best-effort — a failed mark-as-read shouldn't break the page render
  }
}
