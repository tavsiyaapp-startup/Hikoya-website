import "server-only";
import { logQueryError } from "@/lib/queries/query-errors";
import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  bookmarks,
  chapterReads,
  chapters,
  comments,
  follows,
  likes,
  profiles,
  readingProgress,
  readingStatuses,
  stories,
} from "@/server/db/schema";
import { toStoryCard, type StoryCard } from "@/lib/queries/stories";

export async function getUserStoryState(userId: string | undefined, storyId: string) {
  if (!userId)
    return { liked: false, bookmarked: false, readingStatus: null as string | null, continueChapterId: null as string | null };
  try {
    const db = getDb();
    const [[like], [bookmark], [status], [progress]] = await Promise.all([
      db
        .select({ id: likes.id })
        .from(likes)
        .where(and(eq(likes.user_id, userId), eq(likes.target_type, "story"), eq(likes.target_id, storyId)))
        .limit(1),
      db.select({ id: bookmarks.id }).from(bookmarks).where(and(eq(bookmarks.user_id, userId), eq(bookmarks.story_id, storyId))).limit(1),
      db
        .select({ status: readingStatuses.status })
        .from(readingStatuses)
        .where(and(eq(readingStatuses.user_id, userId), eq(readingStatuses.story_id, storyId)))
        .limit(1),
      db
        .select({ chapter_id: readingProgress.chapter_id })
        .from(readingProgress)
        .where(and(eq(readingProgress.user_id, userId), eq(readingProgress.story_id, storyId)))
        .limit(1),
    ]);
    return {
      liked: Boolean(like),
      bookmarked: Boolean(bookmark),
      readingStatus: status?.status ?? null,
      continueChapterId: progress?.chapter_id ?? null,
    };
  } catch (err) {
    logQueryError("getUserStoryState", err);
    return { liked: false, bookmarked: false, readingStatus: null, continueChapterId: null };
  }
}

// Every chapter of this story the user has opened at least once — drives
// the "read" mark on each row of the chapters list. Separate from
// reading_progress (single latest chapter per story, used for the
// continue-reading button above) since this needs the full set, not just
// the most recent one.
export async function getReadChapterIds(userId: string | undefined, storyId: string): Promise<Set<string>> {
  if (!userId) return new Set();
  try {
    const db = getDb();
    const rows = await db
      .select({ chapter_id: chapterReads.chapter_id })
      .from(chapterReads)
      .where(and(eq(chapterReads.user_id, userId), eq(chapterReads.story_id, storyId)));
    return new Set(rows.map((r) => r.chapter_id));
  } catch (err) {
    logQueryError("getReadChapterIds", err);
    return new Set();
  }
}

export async function isFollowingAuthor(userId: string | undefined, authorId: string) {
  if (!userId) return false;
  try {
    const db = getDb();
    const [row] = await db
      .select({ id: follows.id })
      .from(follows)
      .where(and(eq(follows.follower_id, userId), eq(follows.author_id, authorId)))
      .limit(1);
    return Boolean(row);
  } catch (err) {
    logQueryError("isFollowingAuthor", err);
    return false;
  }
}

export async function getFollowerCount(authorId: string) {
  try {
    const db = getDb();
    const [row] = await db.select({ total: count() }).from(follows).where(eq(follows.author_id, authorId));
    return row.total;
  } catch (err) {
    logQueryError("getFollowerCount", err);
    return 0;
  }
}

export type FollowedAuthorGroup = {
  author: { id: string; username: string; display_name: string; avatar_url: string | null };
  stories: StoryCard[];
};

// Powers /library's "Мои подписанные писатели" tab — every author the user
// follows, each with their currently public/published stories underneath.
// Authors with nothing published yet still show up (empty stories array) so
// "who am I following" stays accurate even before they've posted anything.
export async function getFollowedAuthorsWithStories(userId: string): Promise<FollowedAuthorGroup[]> {
  try {
    const db = getDb();
    const authorRows = await db
      .select({
        id: profiles.id,
        username: profiles.username,
        display_name: profiles.display_name,
        avatar_url: profiles.avatar_url,
      })
      .from(follows)
      .innerJoin(profiles, eq(follows.author_id, profiles.id))
      .where(eq(follows.follower_id, userId))
      .orderBy(desc(follows.created_at));

    if (authorRows.length === 0) return [];
    const authorIds = authorRows.map((a) => a.id);

    const storyRows = await db
      .select({ story: stories, author: { username: profiles.username, display_name: profiles.display_name } })
      .from(stories)
      .innerJoin(profiles, eq(stories.author_id, profiles.id))
      .where(
        and(inArray(stories.author_id, authorIds), eq(stories.status, "published"), eq(stories.visibility, "public"))
      )
      .orderBy(desc(stories.published_at));

    const storiesByAuthor = new Map<string, StoryCard[]>();
    for (const row of storyRows) {
      const card = toStoryCard(row.story, row.author);
      const arr = storiesByAuthor.get(card.author_id) ?? [];
      arr.push(card);
      storiesByAuthor.set(card.author_id, arr);
    }

    return authorRows.map((author) => ({ author, stories: storiesByAuthor.get(author.id) ?? [] }));
  } catch (err) {
    logQueryError("getFollowedAuthorsWithStories", err);
    return [];
  }
}

export type CommentRow = {
  id: string;
  chapter_id: string | null;
  story_id: string;
  user_id: string;
  parent_id: string | null;
  text: string;
  like_count: number;
  created_at: string;
  is_spoiler: boolean;
  user: { display_name: string } | null;
};

export type CommentWithReplies = CommentRow & { replies: CommentRow[] };

function buildThreads<T extends CommentRow>(all: T[]): (T & { replies: T[] })[] {
  const repliesByParent = new Map<string, T[]>();
  for (const c of all) {
    if (!c.parent_id) continue;
    const arr = repliesByParent.get(c.parent_id) ?? [];
    arr.push(c);
    repliesByParent.set(c.parent_id, arr);
  }
  return all
    .filter((c) => !c.parent_id)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .map((c) => ({ ...c, replies: repliesByParent.get(c.id) ?? [] }));
}

// Shown threads: the newest top-level comments (up to MAX_THREADS) and every
// reply to them. Hidden comments (hidden_at set by a moderator) are never
// returned. Before, the query was "oldest 300 rows, replies included", so a
// busy chapter stopped showing new comments at all, and hidden comments
// stayed visible to everyone.
const MAX_THREADS = 200;

const COMMENT_COLUMNS = {
  id: comments.id,
  chapter_id: comments.chapter_id,
  story_id: comments.story_id,
  user_id: comments.user_id,
  parent_id: comments.parent_id,
  text: comments.text,
  like_count: comments.like_count,
  created_at: comments.created_at,
  is_spoiler: comments.is_spoiler,
  user: { display_name: profiles.display_name },
};

async function loadThreads(scope: ReturnType<typeof eq>) {
  const db = getDb();
  const visible = and(scope, isNull(comments.hidden_at));
  const topLevel = await db
    .select(COMMENT_COLUMNS)
    .from(comments)
    .innerJoin(profiles, eq(comments.user_id, profiles.id))
    .where(and(visible, isNull(comments.parent_id)))
    .orderBy(desc(comments.created_at))
    .limit(MAX_THREADS);
  if (topLevel.length === 0) return [];
  const replies = await db
    .select(COMMENT_COLUMNS)
    .from(comments)
    .innerJoin(profiles, eq(comments.user_id, profiles.id))
    .where(
      and(
        visible,
        inArray(
          comments.parent_id,
          topLevel.map((c) => c.id)
        )
      )
    )
    .orderBy(asc(comments.created_at));
  return [...topLevel, ...replies];
}

export async function getChapterComments(chapterId: string): Promise<CommentWithReplies[]> {
  try {
    const rows = await loadThreads(eq(comments.chapter_id, chapterId));
    const all: CommentRow[] = rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() }));
    return buildThreads(all);
  } catch (err) {
    console.error("getChapterComments failed:", err);
    return [];
  }
}

export type StoryCommentRow = CommentRow & {
  chapter: { order_index: number; title: string } | null;
};

export type StoryCommentThread = StoryCommentRow & { replies: StoryCommentRow[] };

export async function getStoryComments(storyId: string): Promise<StoryCommentThread[]> {
  try {
    const db = getDb();
    // filtering on comments.story_id (not chapter.story_id) is what makes
    // chapterless story-page comments match at all.
    const rows = await loadThreads(eq(comments.story_id, storyId));
    const chapterIds = [...new Set(rows.map((r) => r.chapter_id).filter((id): id is string => Boolean(id)))];
    const chapterRows =
      chapterIds.length === 0
        ? []
        : await db
            .select({ id: chapters.id, order_index: chapters.order_index, title: chapters.title })
            .from(chapters)
            .where(inArray(chapters.id, chapterIds));
    const chapterById = new Map(chapterRows.map((c) => [c.id, { order_index: c.order_index, title: c.title }]));
    const all: StoryCommentRow[] = rows.map((r) => ({
      ...r,
      created_at: r.created_at.toISOString(),
      chapter: r.chapter_id ? chapterById.get(r.chapter_id) ?? null : null,
    }));
    return buildThreads(all);
  } catch (err) {
    console.error("getStoryComments failed:", err);
    return [];
  }
}

export async function getLikedCommentIds(userId: string | undefined, commentIds: string[]): Promise<Set<string>> {
  if (!userId || commentIds.length === 0) return new Set();
  try {
    const db = getDb();
    const rows = await db
      .select({ target_id: likes.target_id })
      .from(likes)
      .where(and(eq(likes.user_id, userId), eq(likes.target_type, "comment"), inArray(likes.target_id, commentIds)));
    return new Set(rows.map((r) => r.target_id));
  } catch (err) {
    logQueryError("getLikedCommentIds", err);
    return new Set();
  }
}
