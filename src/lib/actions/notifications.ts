"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { notifications } from "@/server/db/schema";

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
    const session = await getAuth().api.getSession({ headers: await headers() });
    const userId = session?.user.id;
    if (!userId) return;
    const db = getDb();
    await db
      .update(notifications)
      .set({ is_read: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.user_id, userId)));
  } catch {
    return;
  }
  revalidatePath("/", "layout");
}
