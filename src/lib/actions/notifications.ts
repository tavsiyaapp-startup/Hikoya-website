"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Called from NotificationsReadMarker (a client component mounted on the
// notifications tab) rather than during the page's own render — revalidatePath
// only works from Server Functions/Route Handlers, and the Header's unread
// badge lives in the shared (site) layout, which Next's client-side router
// cache does NOT automatically refetch on plain navigation (only the page
// segment that changed does). Without this, the badge would clear on the
// notifications page itself but revert to the stale unread count the moment
// you navigated anywhere else.
export async function markAllNotificationsRead(userId: string) {
  try {
    const supabase = await createClient();
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
  } catch {
    // best-effort — a failed mark-as-read shouldn't break the page
    return;
  }
  revalidatePath("/", "layout");
}
