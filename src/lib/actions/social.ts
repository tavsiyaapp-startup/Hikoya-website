"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { createNotification } from "@/lib/actions/create-notification";
import { getAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { bookmarks, comments, follows, likes, stories } from "@/server/db/schema";

async function requireViewerId(): Promise<string | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

export async function toggleStoryLike(storyId: string, path: string) {
  const viewerId = await requireViewerId();
  if (!viewerId) return;

  const db = getDb();
  const [existing] = await db
    .select({ id: likes.id })
    .from(likes)
    .where(and(eq(likes.user_id, viewerId), eq(likes.target_type, "story"), eq(likes.target_id, storyId)))
    .limit(1);

  if (existing) {
    await db.delete(likes).where(eq(likes.id, existing.id));
    revalidatePath(path);
    return;
  }

  await db.insert(likes).values({ user_id: viewerId, target_type: "story", target_id: storyId });

  const [story] = await db.select({ author_id: stories.author_id }).from(stories).where(eq(stories.id, storyId)).limit(1);
  if (story && story.author_id !== viewerId) {
    await createNotification({ userId: story.author_id, actorId: viewerId, type: "story_like", storyId });
  }

  revalidatePath(path);
}

export async function toggleStoryBookmark(storyId: string, path: string) {
  const viewerId = await requireViewerId();
  if (!viewerId) return;

  const db = getDb();
  const [existing] = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(and(eq(bookmarks.user_id, viewerId), eq(bookmarks.story_id, storyId)))
    .limit(1);

  if (existing) {
    await db.delete(bookmarks).where(eq(bookmarks.id, existing.id));
  } else {
    await db.insert(bookmarks).values({ user_id: viewerId, story_id: storyId });
  }
  revalidatePath(path);
}

export async function toggleFollowAuthor(authorId: string, path: string) {
  const viewerId = await requireViewerId();
  if (!viewerId || viewerId === authorId) return;

  const db = getDb();
  const [existing] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.follower_id, viewerId), eq(follows.author_id, authorId)))
    .limit(1);

  if (existing) {
    await db.delete(follows).where(eq(follows.id, existing.id));
  } else {
    await db.insert(follows).values({ follower_id: viewerId, author_id: authorId });
  }
  revalidatePath(path);
}

// chapterId is null for a general comment posted from the story page's own
// "Комментарии" tab (all-chapters view) rather than under a specific
// chapter — storyId is required either way so counters don't need to
// derive it through a chapters join (see migration 0042).
export async function postComment(
  storyId: string,
  chapterId: string | null,
  text: string,
  path: string,
  parentId?: string,
  isSpoiler?: boolean
) {
  const viewerId = await requireViewerId();
  const trimmed = text.trim();
  if (!viewerId || !trimmed) return;

  const db = getDb();
  const [comment] = await db
    .insert(comments)
    .values({
      story_id: storyId,
      chapter_id: chapterId,
      user_id: viewerId,
      text: trimmed,
      parent_id: parentId ?? null,
      is_spoiler: Boolean(isSpoiler),
    })
    .returning({ id: comments.id });
  if (!comment) {
    console.error("postComment failed: insert returned no row");
    return;
  }

  const [story] = await db.select({ id: stories.id, author_id: stories.author_id }).from(stories).where(eq(stories.id, storyId)).limit(1);

  let parentAuthorId: string | null = null;
  if (parentId) {
    const [parent] = await db.select({ user_id: comments.user_id }).from(comments).where(eq(comments.id, parentId)).limit(1);
    parentAuthorId = parent?.user_id ?? null;
    if (parentAuthorId && parentAuthorId !== viewerId) {
      await createNotification({
        userId: parentAuthorId,
        actorId: viewerId,
        type: "comment_reply",
        storyId: story?.id,
        chapterId,
        commentId: comment.id,
      });
    }
  }

  if (story && story.author_id !== viewerId && story.author_id !== parentAuthorId) {
    await createNotification({
      userId: story.author_id,
      actorId: viewerId,
      type: "new_comment",
      storyId: story.id,
      chapterId,
      commentId: comment.id,
    });
  }

  revalidatePath(path);
}

export async function toggleCommentLike(commentId: string, path: string) {
  const viewerId = await requireViewerId();
  if (!viewerId) return;

  const db = getDb();
  const [existing] = await db
    .select({ id: likes.id })
    .from(likes)
    .where(and(eq(likes.user_id, viewerId), eq(likes.target_type, "comment"), eq(likes.target_id, commentId)))
    .limit(1);

  if (existing) {
    await db.delete(likes).where(eq(likes.id, existing.id));
    revalidatePath(path);
    return;
  }

  await db.insert(likes).values({ user_id: viewerId, target_type: "comment", target_id: commentId });

  // comments.story_id is set directly on every comment (chapter-attached
  // or not) — used here instead of going through chapters the way
  // Supabase's nested select used to, which left storyId unset for a
  // chapterless (general story-page) comment's likes.
  const [row] = await db
    .select({ user_id: comments.user_id, chapter_id: comments.chapter_id, story_id: comments.story_id })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  if (row && row.user_id !== viewerId) {
    await createNotification({
      userId: row.user_id,
      actorId: viewerId,
      type: "comment_like",
      storyId: row.story_id,
      chapterId: row.chapter_id,
      commentId,
    });
  }

  revalidatePath(path);
}
