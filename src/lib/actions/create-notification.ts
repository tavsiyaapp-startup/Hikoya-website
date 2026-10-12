import "server-only";
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
  message?: string | null;
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
    await db.insert(notifications).values({
      user_id: input.userId,
      actor_id: input.actorId ?? null,
      type: input.type,
      story_id: input.storyId ?? null,
      chapter_id: input.chapterId ?? null,
      comment_id: input.commentId ?? null,
      message: input.message ?? null,
    });
  } catch (err) {
    console.error(`createNotification(${input.type}) failed:`, err);
  }
}
