"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Called from NotificationItem's "Прочитано" button — notifications are only
// marked read by explicit action now, not just by visiting the tab.
// revalidatePath only works from Server Functions/Route Handlers, and the
// Header's unread badge lives in the shared (site) layout, which Next's
// client-side router cache does NOT automatically refetch on plain
// navigation (only the page segment that changed does) — without this, the
// badge would clear here but revert to the stale count on the next
// navigation.
export async function markNotificationRead(notificationId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId).eq("user_id", user.id);
  } catch {
    return;
  }
  revalidatePath("/", "layout");
}
