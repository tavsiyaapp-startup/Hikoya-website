import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { notifications } from "@/server/db/schema";
import type { NotificationType } from "@/types/database";

interface NotifyInput {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  storyId?: string | null;
  chapterId?: string | null;
  commentId?: string | null;
  forumPostId?: string | null;
  forumCommentId?: string | null;
  message?: string | null;
  // Skip when the same actor already notified the same user about the same
  // thing — like, unlike, like again would otherwise send one notification
  // per click.
  once?: boolean;
}

// Shared by src/lib/actions/social.ts (comments/likes) and
// src/lib/actions/admin.ts (moderation outcomes). Used to always go
// through the service-role client since the recipient (userId) is never
// the caller (auth.uid()), so the plain RLS-scoped client couldn't insert
// this row — moot now, Drizzle/pg here never went through RLS at all.
//
// Never throws: a notification is a side effect of an action that has
// already been saved (story approved, comment posted...). Letting a failed
// notification insert throw used to skip the caller's cache revalidation and
// show the user an error for a change that had in fact succeeded.
export async function createNotification(input: NotifyInput) {
  if (input.actorId && input.actorId === input.userId) return;
  try {
    const db = getDb();
    if (input.once && input.actorId) {
      const [existing] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.user_id, input.userId),
            eq(notifications.actor_id, input.actorId),
            eq(notifications.type, input.type),
            input.storyId ? eq(notifications.story_id, input.storyId) : isNull(notifications.story_id),
            input.commentId ? eq(notifications.comment_id, input.commentId) : isNull(notifications.comment_id)
          )
        )
        .limit(1);
      if (existing) return;
    }
    await db.insert(notifications).values({
      user_id: input.userId,
      actor_id: input.actorId ?? null,
      type: input.type,
      story_id: input.storyId ?? null,
      chapter_id: input.chapterId ?? null,
      comment_id: input.commentId ?? null,
      forum_post_id: input.forumPostId ?? null,
      forum_comment_id: input.forumCommentId ?? null,
      message: input.message ?? null,
    });
  } catch (err) {
    console.error(`createNotification(${input.type}) failed:`, err);
  }
}
