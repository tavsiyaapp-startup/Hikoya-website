"use server";

import { revalidateClientPath } from "@/lib/revalidate-client-path";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { createNotification } from "@/lib/actions/create-notification";
import { getAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { bookmarks, chapters, comments, follows, likes } from "@/server/db/schema";
import { loadViewer } from "@/server/data/viewer";
import { getStoryRecord } from "@/server/data/stories";
import { getStoryComments, type StoryCommentThread } from "@/lib/queries/social";
import {
  canCommentOnChapter,
  canCommentOnStory,
  canViewChapter,
  canViewStory,
  isActive,
  type Viewer,
} from "@/server/authz/policy";

// Toggle actions return the resulting state (true = now liked/bookmarked/
// followed, false = now removed) or null when the action was refused
// (signed out, blocked, story not visible...). The buttons update
// optimistically and use this to settle on the real state — before, a
// refused or failed toggle left the button showing "liked" while nothing
// was saved.
export type ToggleResult = boolean | null;

export type PostCommentResult = { ok: true } | { error: "unauthorized" | "too_long" | "empty" | "not_allowed" };

async function getSessionUserId(): Promise<string | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

const MAX_COMMENT_LENGTH = 5000;

// Likes, comments and follows are public actions — a blocked account
// (profiles.status = 'blocked') may still read and bookmark, but not do
// these (owner's rule; see src/server/authz/policy.ts isActive). Returns the
// viewer only when signed in AND active.
async function requireActiveViewer(): Promise<Viewer | null> {
  const viewerId = await getSessionUserId();
  if (!viewerId) return null;
  const viewer = await loadViewer(getDb(), viewerId);
  return viewer && isActive(viewer) ? viewer : null;
}

async function requireViewer(): Promise<Viewer | null> {
  const viewerId = await getSessionUserId();
  if (!viewerId) return null;
  return loadViewer(getDb(), viewerId);
}

// Lazy-loaded by the story page's Comments tab (StoryTabs), so the comments
// query no longer runs on every story view — only when a reader opens the tab,
// and again right after they post one (so a new comment shows immediately).
// Comments are as public as the story page itself, so this gates on the same
// visibility rule: a hidden/draft/deleted story returns nothing for a viewer
// who couldn't open it.
export async function fetchStoryComments(storyId: string): Promise<StoryCommentThread[]> {
  const db = getDb();
  const storyRecord = await getStoryRecord(db, storyId);
  if (!storyRecord) return [];
  const viewerId = await getSessionUserId();
  const viewer = viewerId ? await loadViewer(db, viewerId) : null;
  if (!canViewStory(viewer, storyRecord)) return [];
  return getStoryComments(storyId);
}

export async function toggleStoryLike(storyId: string, path: string): Promise<ToggleResult> {
  const viewer = await requireActiveViewer();
  if (!viewer) return null;

  const db = getDb();
  const removed = await db
    .delete(likes)
    .where(and(eq(likes.user_id, viewer.id), eq(likes.target_type, "story"), eq(likes.target_id, storyId)))
    .returning({ id: likes.id });
  if (removed.length > 0) {
    revalidateClientPath(path);
    return false;
  }

  const storyRecord = await getStoryRecord(db, storyId);
  if (!storyRecord || !canViewStory(viewer, storyRecord)) return null;

  // onConflictDoNothing: a double click (two requests racing past the delete
  // above) no longer hits the unique constraint and fails with a 500.
  const inserted = await db
    .insert(likes)
    .values({ user_id: viewer.id, target_type: "story", target_id: storyId })
    .onConflictDoNothing()
    .returning({ id: likes.id });
  revalidateClientPath(path);

  if (inserted.length > 0 && storyRecord.author_id !== viewer.id) {
    await createNotification({ userId: storyRecord.author_id, actorId: viewer.id, type: "story_like", storyId, once: true });
  }
  return true;
}

// Bookmarks are private, so a blocked account may still use them — but only
// on stories it can actually see (otherwise a crafted id would put a draft's
// title/cover into the library list).
export async function toggleStoryBookmark(storyId: string, path: string): Promise<ToggleResult> {
  const viewer = await requireViewer();
  if (!viewer) return null;

  const db = getDb();
  const removed = await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.user_id, viewer.id), eq(bookmarks.story_id, storyId)))
    .returning({ id: bookmarks.id });
  if (removed.length > 0) {
    revalidateClientPath(path);
    return false;
  }

  const storyRecord = await getStoryRecord(db, storyId);
  if (!storyRecord || !canViewStory(viewer, storyRecord)) return null;

  await db.insert(bookmarks).values({ user_id: viewer.id, story_id: storyId }).onConflictDoNothing();
  revalidateClientPath(path);
  return true;
}

export async function toggleFollowAuthor(authorId: string, path: string): Promise<ToggleResult> {
  const viewer = await requireActiveViewer();
  if (!viewer || viewer.id === authorId) return null;

  const db = getDb();
  const removed = await db
    .delete(follows)
    .where(and(eq(follows.follower_id, viewer.id), eq(follows.author_id, authorId)))
    .returning({ id: follows.id });
  if (removed.length === 0) {
    await db.insert(follows).values({ follower_id: viewer.id, author_id: authorId }).onConflictDoNothing();
  }
  revalidateClientPath(path);
  return removed.length === 0;
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
): Promise<PostCommentResult> {
  const viewer = await requireActiveViewer();
  if (!viewer) return { error: "unauthorized" };
  const trimmed = text.trim();
  if (!trimmed) return { error: "empty" };
  if (trimmed.length > MAX_COMMENT_LENGTH) return { error: "too_long" };

  const db = getDb();
  // Only on content the commenter can actually see, and the chapter/parent
  // must belong to this same story — otherwise a crafted call could comment
  // on drafts or attach a reply/notification to an unrelated thread.
  const storyRecord = await getStoryRecord(db, storyId);
  if (!storyRecord) return { error: "not_allowed" };
  if (chapterId) {
    const [chapter] = await db
      .select({ id: chapters.id, story_id: chapters.story_id, status: chapters.status })
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .limit(1);
    if (!chapter || !canCommentOnChapter(viewer, chapter, storyRecord)) return { error: "not_allowed" };
  } else if (!canCommentOnStory(viewer, storyRecord)) {
    return { error: "not_allowed" };
  }

  let parentAuthorId: string | null = null;
  if (parentId) {
    const [parentRow] = await db
      .select({ story_id: comments.story_id, user_id: comments.user_id, hidden_at: comments.hidden_at })
      .from(comments)
      .where(eq(comments.id, parentId))
      .limit(1);
    if (!parentRow || parentRow.story_id !== storyId || parentRow.hidden_at) return { error: "not_allowed" };
    parentAuthorId = parentRow.user_id;
  }

  const [comment] = await db
    .insert(comments)
    .values({
      story_id: storyId,
      chapter_id: chapterId,
      user_id: viewer.id,
      text: trimmed,
      parent_id: parentId ?? null,
      is_spoiler: Boolean(isSpoiler),
    })
    .returning({ id: comments.id });
  revalidateClientPath(path);

  if (parentAuthorId && parentAuthorId !== viewer.id) {
    await createNotification({
      userId: parentAuthorId,
      actorId: viewer.id,
      type: "comment_reply",
      storyId,
      chapterId,
      commentId: comment.id,
    });
  }

  if (storyRecord.author_id !== viewer.id && storyRecord.author_id !== parentAuthorId) {
    await createNotification({
      userId: storyRecord.author_id,
      actorId: viewer.id,
      type: "new_comment",
      storyId,
      chapterId,
      commentId: comment.id,
    });
  }

  return { ok: true };
}

export async function toggleCommentLike(commentId: string, path: string): Promise<ToggleResult> {
  const viewer = await requireActiveViewer();
  if (!viewer) return null;

  const db = getDb();
  const removed = await db
    .delete(likes)
    .where(and(eq(likes.user_id, viewer.id), eq(likes.target_type, "comment"), eq(likes.target_id, commentId)))
    .returning({ id: likes.id });
  if (removed.length > 0) {
    revalidateClientPath(path);
    return false;
  }

  const [target] = await db
    .select({
      user_id: comments.user_id,
      chapter_id: comments.chapter_id,
      story_id: comments.story_id,
      hidden_at: comments.hidden_at,
    })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  if (!target || target.hidden_at) return null;

  // The comment's story (and chapter, for a chapter comment) must be visible
  // to the liker — otherwise comments on drafts/hidden stories could be liked
  // and their authors notified.
  const storyRecord = await getStoryRecord(db, target.story_id);
  if (!storyRecord || !canViewStory(viewer, storyRecord)) return null;
  if (target.chapter_id) {
    const [chapter] = await db
      .select({ id: chapters.id, story_id: chapters.story_id, status: chapters.status })
      .from(chapters)
      .where(eq(chapters.id, target.chapter_id))
      .limit(1);
    if (!chapter || !canViewChapter(viewer, chapter, storyRecord)) return null;
  }

  const inserted = await db
    .insert(likes)
    .values({ user_id: viewer.id, target_type: "comment", target_id: commentId })
    .onConflictDoNothing()
    .returning({ id: likes.id });
  revalidateClientPath(path);

  if (inserted.length > 0 && target.user_id !== viewer.id) {
    await createNotification({
      userId: target.user_id,
      actorId: viewer.id,
      type: "comment_like",
      storyId: target.story_id,
      chapterId: target.chapter_id,
      commentId,
      once: true,
    });
  }
  return true;
}
