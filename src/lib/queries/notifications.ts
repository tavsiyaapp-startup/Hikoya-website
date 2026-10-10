import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { chapters, notifications, profiles, stories } from "@/server/db/schema";
import type { Notification } from "@/types/database";

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const db = getDb();
    const rows = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.user_id, userId), eq(notifications.is_read, false)));
    return rows.length;
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
    const db = getDb();
    const rows = await db
      .select({
        notification: notifications,
        actor: { display_name: profiles.display_name },
        story: { title: stories.title, slug: stories.slug },
        chapter: { order_index: chapters.order_index, title: chapters.title },
      })
      .from(notifications)
      .leftJoin(profiles, eq(notifications.actor_id, profiles.id))
      .leftJoin(stories, eq(notifications.story_id, stories.id))
      .leftJoin(chapters, eq(notifications.chapter_id, chapters.id))
      .where(eq(notifications.user_id, userId))
      .orderBy(desc(notifications.created_at))
      .limit(limit);
    return rows.map((r) => ({
      ...r.notification,
      created_at: r.notification.created_at.toISOString(),
      actor: r.notification.actor_id ? r.actor : null,
      story: r.notification.story_id ? r.story : null,
      chapter: r.notification.chapter_id ? r.chapter : null,
    }));
  } catch {
    return [];
  }
}
