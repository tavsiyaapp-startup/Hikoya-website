import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
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
// src/lib/actions/admin.ts (moderation outcomes) — always goes through the
// service-role client since the recipient (userId) is never the caller
// (auth.uid()), so the plain RLS-scoped client can't insert this row.
export async function createNotification(input: NotifyInput) {
  if (input.actorId && input.actorId === input.userId) return;
  const admin = createAdminClient();
  await admin.from("notifications").insert({
    user_id: input.userId,
    actor_id: input.actorId ?? null,
    type: input.type,
    story_id: input.storyId ?? null,
    chapter_id: input.chapterId ?? null,
    comment_id: input.commentId ?? null,
    message: input.message ?? null,
  });
}
