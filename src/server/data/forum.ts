import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, count, desc, eq, gt, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import {
  canChangeUserStatus,
  canCommentOnForumPost,
  canCreateForumPost,
  canDeleteForumItem,
  canLikeForumComment,
  canLinkStoryToRequest,
  canModerateForum,
  canReportForumItem,
  canViewForumItem,
  canVoteForumPost,
  isStaff,
  isStoryPubliclyVisible,
  type Viewer,
} from "@/server/authz/policy";
import type { DbOrTx } from "@/server/db/client";
import {
  follows,
  forumCommentLikes,
  forumComments,
  forumPosts,
  forumReports,
  forumVotes,
  profiles,
  stories,
} from "@/server/db/schema";
import { AlreadyResolvedError, ForbiddenError, NotFoundError } from "@/server/data/errors";
import { isValidReportReason, type ReportAction } from "@/server/data/logic";
import type { ForumCategory } from "@/types/database";

// Muhokamalar — community topics with upvotes and one level of replies.
// Counters (vote_count, comment_count, like_count) live on the rows and are
// changed here in the same transaction as the vote/comment, so lists never
// count rows. Permission rules are in src/server/authz/policy.ts.

export const FORUM_CATEGORIES: readonly ForumCategory[] = ["muhokama", "maslahat", "tavsiya", "sorov", "elon"];
export const FORUM_PAGE_SIZE = 20;
export const MAX_FORUM_TITLE = 200;
export const MAX_FORUM_BODY = 10000;
export const MAX_FORUM_COMMENT = 5000;

export type ForumSort = "hot" | "new" | "top";
export type ForumPeriod = "week" | "month" | "all";

export class ForumInputError extends Error {
  constructor(readonly code: "title" | "body" | "story" | "category") {
    super(`Invalid forum input: ${code}`);
    this.name = "ForumInputError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ids arrive from URLs and client calls; a malformed one would make
// Postgres throw on the uuid cast instead of simply finding nothing.
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function isForumCategory(value: unknown): value is ForumCategory {
  return typeof value === "string" && (FORUM_CATEGORIES as readonly string[]).includes(value);
}

export interface ForumAuthor {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export interface ForumStoryRef {
  slug: string;
  title: string;
}

export interface ForumPostItem {
  id: string;
  category: ForumCategory;
  title: string;
  body: string;
  vote_count: number;
  comment_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  hidden: boolean;
  created_at: string;
  author: ForumAuthor;
  story: ForumStoryRef | null;
  votedByMe: boolean;
  // People the viewer follows who commented in this topic (list page only).
  followedRepliers: { username: string; display_name: string }[];
}

export interface ForumCommentItem {
  id: string;
  parent_id: string | null;
  body: string;
  like_count: number;
  created_at: string;
  hidden: boolean;
  author: ForumAuthor;
  story: ForumStoryRef | null;
  likedByMe: boolean;
  // The viewer follows this comment's author — shown first, with a badge.
  byFollowed: boolean;
  replies: ForumCommentItem[];
}

// Reddit-style "hot": votes, discounted by age in hours (HN gravity 1.5),
// so a fresh topic with a few votes rises above an old one with many.
const hotScore = sql`(${forumPosts.vote_count} + 1) / power(extract(epoch from (now() - ${forumPosts.created_at})) / 3600 + 2, 1.5)`;

// Only a story anyone can open gets a card next to a topic or comment.
function publicStoryJoin(storyIdColumn: typeof forumPosts.story_id | typeof forumComments.story_id) {
  return and(
    eq(stories.id, storyIdColumn),
    isNull(stories.deleted_at),
    eq(stories.status, "published"),
    inArray(stories.visibility, ["public", "unlisted"])
  );
}

const authorColumns = {
  id: profiles.id,
  username: profiles.username,
  display_name: profiles.display_name,
  avatar_url: profiles.avatar_url,
};

const postColumns = {
  id: forumPosts.id,
  author_id: forumPosts.author_id,
  category: forumPosts.category,
  title: forumPosts.title,
  body: forumPosts.body,
  vote_count: forumPosts.vote_count,
  comment_count: forumPosts.comment_count,
  is_pinned: forumPosts.is_pinned,
  is_locked: forumPosts.is_locked,
  hidden_at: forumPosts.hidden_at,
  created_at: forumPosts.created_at,
};

type PostRow = {
  post: Pick<typeof forumPosts.$inferSelect, keyof typeof postColumns>;
  author: ForumAuthor;
  // null when the topic has no story or it isn't public (left join).
  story: ForumStoryRef | null;
  voted: boolean;
};

function storyRef(story: ForumStoryRef | null): ForumStoryRef | null {
  return story ? { slug: story.slug, title: story.title } : null;
}

function toPostItem(row: PostRow): ForumPostItem {
  const p = row.post;
  return {
    id: p.id,
    category: p.category,
    title: p.title,
    body: p.body,
    vote_count: p.vote_count,
    comment_count: p.comment_count,
    is_pinned: p.is_pinned,
    is_locked: p.is_locked,
    hidden: Boolean(p.hidden_at),
    created_at: p.created_at.toISOString(),
    author: row.author,
    story: storyRef(row.story),
    votedByMe: Boolean(row.voted),
    followedRepliers: [],
  };
}

function postSelect(db: DbOrTx, viewer: Viewer | null) {
  const voted = viewer ? sql<boolean>`(${forumVotes.user_id} is not null)` : sql<boolean>`false`;
  const base = db
    .select({
      post: postColumns,
      author: authorColumns,
      story: { slug: stories.slug, title: stories.title },
      voted,
    })
    .from(forumPosts)
    .innerJoin(profiles, eq(profiles.id, forumPosts.author_id))
    .leftJoin(stories, publicStoryJoin(forumPosts.story_id))
    .$dynamic();
  return viewer
    ? base.leftJoin(forumVotes, and(eq(forumVotes.post_id, forumPosts.id), eq(forumVotes.user_id, viewer.id)))
    : base;
}

// Who among the people `viewerId` follows commented in each of these topics.
// One query for the whole page: follows is looked up by its
// (follower_id, author_id) key, comments by (post_id, author_id).
async function loadFollowedRepliers(db: DbOrTx, viewerId: string, postIds: string[]) {
  const map = new Map<string, { username: string; display_name: string }[]>();
  if (postIds.length === 0) return map;
  const rows = await db
    .selectDistinct({ post_id: forumComments.post_id, username: profiles.username, display_name: profiles.display_name })
    .from(forumComments)
    .innerJoin(follows, and(eq(follows.author_id, forumComments.author_id), eq(follows.follower_id, viewerId)))
    .innerJoin(profiles, eq(profiles.id, forumComments.author_id))
    .where(and(inArray(forumComments.post_id, postIds), isNull(forumComments.hidden_at)));
  for (const r of rows) {
    const list = map.get(r.post_id) ?? [];
    list.push({ username: r.username, display_name: r.display_name });
    map.set(r.post_id, list);
  }
  return map;
}

export async function listForumPosts(
  db: DbOrTx,
  viewer: Viewer | null,
  opts: { category?: ForumCategory; sort: ForumSort; period: ForumPeriod; page: number }
): Promise<{ posts: ForumPostItem[]; total: number }> {
  const conds: SQL[] = [];
  if (!isStaff(viewer)) conds.push(isNull(forumPosts.hidden_at));
  if (opts.category) conds.push(eq(forumPosts.category, opts.category));
  if (opts.sort === "top" && opts.period !== "all") {
    const interval = opts.period === "week" ? sql.raw("interval '7 days'") : sql.raw("interval '30 days'");
    conds.push(gt(forumPosts.created_at, sql`now() - ${interval}`));
  }
  const where = conds.length > 0 ? and(...conds) : undefined;

  const order =
    opts.sort === "hot"
      ? [desc(forumPosts.is_pinned), desc(hotScore), desc(forumPosts.created_at)]
      : opts.sort === "new"
        ? [desc(forumPosts.is_pinned), desc(forumPosts.created_at)]
        : [desc(forumPosts.vote_count), desc(forumPosts.created_at)];

  const page = Math.max(1, Math.floor(opts.page) || 1);
  const [rows, [{ total }]] = await Promise.all([
    postSelect(db, viewer)
      .where(where)
      .orderBy(...order)
      .limit(FORUM_PAGE_SIZE)
      .offset((page - 1) * FORUM_PAGE_SIZE),
    db.select({ total: count() }).from(forumPosts).where(where),
  ]);

  const posts = rows.map(toPostItem);
  if (viewer) {
    const repliers = await loadFollowedRepliers(db, viewer.id, posts.map((p) => p.id));
    for (const p of posts) p.followedRepliers = repliers.get(p.id) ?? [];
  }
  return { posts, total };
}

// Someone's own topics, newest first — the profile's «Mening mavzularim» tab.
export async function listForumPostsByAuthor(db: DbOrTx, viewer: Viewer | null, authorId: string): Promise<ForumPostItem[]> {
  const rows = await postSelect(db, viewer)
    .where(and(eq(forumPosts.author_id, authorId), isNull(forumPosts.hidden_at)))
    .orderBy(desc(forumPosts.created_at))
    .limit(100);
  return rows.map(toPostItem);
}

export async function getForumPost(db: DbOrTx, viewer: Viewer | null, postId: string): Promise<ForumPostItem | null> {
  if (!isUuid(postId)) return null;
  const [row] = await postSelect(db, viewer).where(eq(forumPosts.id, postId)).limit(1);
  if (!row || !canViewForumItem(viewer, row.post)) return null;
  return toPostItem(row);
}

export async function listForumComments(
  db: DbOrTx,
  viewer: Viewer | null,
  postId: string,
  sort: "best" | "new"
): Promise<ForumCommentItem[]> {
  const liked = viewer ? sql<boolean>`(${forumCommentLikes.user_id} is not null)` : sql<boolean>`false`;
  const followed = viewer ? sql<boolean>`(${follows.id} is not null)` : sql<boolean>`false`;
  let query = db
    .select({
      id: forumComments.id,
      parent_id: forumComments.parent_id,
      body: forumComments.body,
      like_count: forumComments.like_count,
      created_at: forumComments.created_at,
      hidden_at: forumComments.hidden_at,
      author: authorColumns,
      story: { slug: stories.slug, title: stories.title },
      liked,
      followed,
    })
    .from(forumComments)
    .innerJoin(profiles, eq(profiles.id, forumComments.author_id))
    .leftJoin(stories, publicStoryJoin(forumComments.story_id))
    .$dynamic();
  if (viewer) {
    query = query
      .leftJoin(forumCommentLikes, and(eq(forumCommentLikes.comment_id, forumComments.id), eq(forumCommentLikes.user_id, viewer.id)))
      .leftJoin(follows, and(eq(follows.author_id, forumComments.author_id), eq(follows.follower_id, viewer.id)));
  }
  const visible = isStaff(viewer)
    ? eq(forumComments.post_id, postId)
    : and(eq(forumComments.post_id, postId), isNull(forumComments.hidden_at));
  const rows = await query.where(visible).orderBy(asc(forumComments.created_at)).limit(2000);

  const items: ForumCommentItem[] = rows.map((r) => ({
    id: r.id,
    parent_id: r.parent_id,
    body: r.body,
    like_count: r.like_count,
    created_at: r.created_at.toISOString(),
    hidden: Boolean(r.hidden_at),
    author: r.author,
    story: storyRef(r.story),
    likedByMe: Boolean(r.liked),
    byFollowed: Boolean(r.followed),
    replies: [],
  }));

  const top = items.filter((c) => !c.parent_id);
  const byId = new Map(top.map((c) => [c.id, c]));
  // Replies stay in the order they were written; a reply whose parent was
  // hidden has nothing to hang under and is left out.
  for (const c of items) {
    if (c.parent_id) byId.get(c.parent_id)?.replies.push(c);
  }

  // People the viewer follows come first, then the chosen order.
  top.sort((a, b) => {
    if (a.byFollowed !== b.byFollowed) return a.byFollowed ? -1 : 1;
    if (sort === "new") return b.created_at.localeCompare(a.created_at);
    if (a.like_count !== b.like_count) return b.like_count - a.like_count;
    return a.created_at.localeCompare(b.created_at);
  });
  return top;
}

// --- Writes ---

async function loadPostRecord(db: DbOrTx, postId: string) {
  if (!isUuid(postId)) return null;
  const [row] = await db
    .select({
      id: forumPosts.id,
      author_id: forumPosts.author_id,
      category: forumPosts.category,
      is_locked: forumPosts.is_locked,
      hidden_at: forumPosts.hidden_at,
    })
    .from(forumPosts)
    .where(eq(forumPosts.id, postId))
    .limit(1);
  return row ?? null;
}

async function loadCommentRecord(db: DbOrTx, commentId: string) {
  if (!isUuid(commentId)) return null;
  const [row] = await db
    .select({
      id: forumComments.id,
      post_id: forumComments.post_id,
      parent_id: forumComments.parent_id,
      author_id: forumComments.author_id,
      hidden_at: forumComments.hidden_at,
    })
    .from(forumComments)
    .where(eq(forumComments.id, commentId))
    .limit(1);
  return row ?? null;
}

const storyRecordColumns = {
  id: stories.id,
  author_id: stories.author_id,
  status: stories.status,
  visibility: stories.visibility,
  deleted_at: stories.deleted_at,
};

// «hikoya.org/story/slug», «/story/slug/3» or a bare slug → a story anyone
// can open. Anything else is refused rather than silently dropped.
async function resolveStoryRef(db: DbOrTx, ref: string): Promise<string | null> {
  const trimmed = ref.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/story\/([^/?#\s]+)/);
  let slug = match ? match[1] : /^[\p{L}\p{N}_-]+$/u.test(trimmed) ? trimmed : null;
  if (!slug) throw new ForumInputError("story");
  try {
    slug = decodeURIComponent(slug);
  } catch {
    throw new ForumInputError("story");
  }
  const [story] = await db.select(storyRecordColumns).from(stories).where(eq(stories.slug, slug)).limit(1);
  if (!story || !isStoryPubliclyVisible(story)) throw new ForumInputError("story");
  return story.id;
}

export async function createForumPost(
  db: DbOrTx,
  viewer: Viewer | null,
  input: { category: string; title: string; body: string; storyRef?: string }
): Promise<string> {
  if (!isForumCategory(input.category)) throw new ForumInputError("category");
  if (!canCreateForumPost(viewer, input.category)) throw new ForbiddenError();
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 3 || title.length > MAX_FORUM_TITLE) throw new ForumInputError("title");
  if (body.length > MAX_FORUM_BODY) throw new ForumInputError("body");
  const storyId = input.storyRef ? await resolveStoryRef(db, input.storyRef) : null;

  const [row] = await db
    .insert(forumPosts)
    .values({ author_id: viewer!.id, category: input.category, title, body, story_id: storyId })
    .returning({ id: forumPosts.id });
  return row.id;
}

export interface CreatedForumComment {
  id: string;
  postId: string;
  postAuthorId: string;
  // Author of the comment being answered (null for a top-level comment).
  repliedToAuthorId: string | null;
}

export async function createForumComment(
  db: DbOrTx,
  viewer: Viewer | null,
  input: { postId: string; body: string; parentId?: string | null; storyId?: string | null }
): Promise<CreatedForumComment> {
  const post = await loadPostRecord(db, input.postId);
  if (!post) throw new NotFoundError("Topic");
  if (!canCommentOnForumPost(viewer, post)) throw new ForbiddenError();
  const body = input.body.trim();
  if (!body || body.length > MAX_FORUM_COMMENT) throw new ForumInputError("body");

  // One level of replies: answering a reply hangs the new one under the
  // same top-level comment (Threads-style), but still notifies the person
  // who was answered.
  let parentId: string | null = null;
  let repliedToAuthorId: string | null = null;
  if (input.parentId) {
    const parent = await loadCommentRecord(db, input.parentId);
    if (!parent || parent.post_id !== post.id || parent.hidden_at) throw new NotFoundError("Comment");
    parentId = parent.parent_id ?? parent.id;
    repliedToAuthorId = parent.author_id;
  }

  // In a «Soʻrov» topic an author may answer with one of their own stories.
  let storyId: string | null = null;
  if (input.storyId && post.category === "sorov") {
    if (!isUuid(input.storyId)) throw new ForumInputError("story");
    const [story] = await db.select(storyRecordColumns).from(stories).where(eq(stories.id, input.storyId)).limit(1);
    if (!story || !isStoryPubliclyVisible(story) || !canLinkStoryToRequest(viewer, story)) throw new ForumInputError("story");
    storyId = story.id;
  }

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(forumComments)
      .values({ post_id: post.id, author_id: viewer!.id, parent_id: parentId, body, story_id: storyId })
      .returning({ id: forumComments.id });
    await tx
      .update(forumPosts)
      .set({ comment_count: sql`${forumPosts.comment_count} + 1` })
      .where(eq(forumPosts.id, post.id));
    return row.id;
  });

  return { id, postId: post.id, postAuthorId: post.author_id, repliedToAuthorId };
}

export async function toggleForumVote(db: DbOrTx, viewer: Viewer | null, postId: string): Promise<{ voted: boolean; count: number }> {
  const post = await loadPostRecord(db, postId);
  if (!post) throw new NotFoundError("Topic");
  if (!canVoteForumPost(viewer, post)) throw new ForbiddenError();

  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(forumVotes)
      .where(and(eq(forumVotes.post_id, post.id), eq(forumVotes.user_id, viewer!.id)))
      .returning({ post_id: forumVotes.post_id });
    let voted = false;
    let delta = -removed.length;
    if (removed.length === 0) {
      const inserted = await tx
        .insert(forumVotes)
        .values({ post_id: post.id, user_id: viewer!.id })
        .onConflictDoNothing()
        .returning({ post_id: forumVotes.post_id });
      voted = true;
      delta = inserted.length;
    }
    const [row] = await tx
      .update(forumPosts)
      .set({ vote_count: sql`greatest(${forumPosts.vote_count} + ${delta}, 0)` })
      .where(eq(forumPosts.id, post.id))
      .returning({ count: forumPosts.vote_count });
    return { voted, count: row.count };
  });
}

export async function toggleForumCommentLike(
  db: DbOrTx,
  viewer: Viewer | null,
  commentId: string
): Promise<{ liked: boolean; count: number }> {
  const comment = await loadCommentRecord(db, commentId);
  if (!comment) throw new NotFoundError("Comment");
  const post = await loadPostRecord(db, comment.post_id);
  if (!post || !canViewForumItem(viewer, post) || !canLikeForumComment(viewer, comment)) throw new ForbiddenError();

  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(forumCommentLikes)
      .where(and(eq(forumCommentLikes.comment_id, comment.id), eq(forumCommentLikes.user_id, viewer!.id)))
      .returning({ comment_id: forumCommentLikes.comment_id });
    let liked = false;
    let delta = -removed.length;
    if (removed.length === 0) {
      const inserted = await tx
        .insert(forumCommentLikes)
        .values({ comment_id: comment.id, user_id: viewer!.id })
        .onConflictDoNothing()
        .returning({ comment_id: forumCommentLikes.comment_id });
      liked = true;
      delta = inserted.length;
    }
    const [row] = await tx
      .update(forumComments)
      .set({ like_count: sql`greatest(${forumComments.like_count} + ${delta}, 0)` })
      .where(eq(forumComments.id, comment.id))
      .returning({ count: forumComments.like_count });
    return { liked, count: row.count };
  });
}

// comment_count = comments a reader can see: not hidden, and not a reply
// under a hidden comment. Recounted after a delete or hide (cheap: one
// topic's comments, by index) instead of guessing how many went with it.
async function recountComments(db: DbOrTx, postId: string) {
  const parent = alias(forumComments, "parent_comment");
  const [{ total }] = await db
    .select({ total: count() })
    .from(forumComments)
    .leftJoin(parent, eq(parent.id, forumComments.parent_id))
    .where(
      and(
        eq(forumComments.post_id, postId),
        isNull(forumComments.hidden_at),
        or(isNull(forumComments.parent_id), isNull(parent.hidden_at))
      )
    );
  await db.update(forumPosts).set({ comment_count: total }).where(eq(forumPosts.id, postId));
}

export async function deleteForumPost(db: DbOrTx, viewer: Viewer | null, postId: string): Promise<void> {
  const post = await loadPostRecord(db, postId);
  if (!post) throw new NotFoundError("Topic");
  if (!canDeleteForumItem(viewer, post)) throw new ForbiddenError();
  await db.delete(forumPosts).where(eq(forumPosts.id, post.id));
}

export async function deleteForumComment(db: DbOrTx, viewer: Viewer | null, commentId: string): Promise<string> {
  const comment = await loadCommentRecord(db, commentId);
  if (!comment) throw new NotFoundError("Comment");
  if (!canDeleteForumItem(viewer, comment)) throw new ForbiddenError();
  await db.transaction(async (tx) => {
    await tx.delete(forumComments).where(eq(forumComments.id, comment.id));
    await recountComments(tx, comment.post_id);
  });
  return comment.post_id;
}

export type ForumModeration = "pin" | "unpin" | "lock" | "unlock" | "hide" | "unhide";
export const FORUM_MODERATIONS: readonly ForumModeration[] = ["pin", "unpin", "lock", "unlock", "hide", "unhide"];

export async function moderateForumPost(db: DbOrTx, viewer: Viewer | null, postId: string, action: ForumModeration): Promise<void> {
  if (!canModerateForum(viewer)) throw new ForbiddenError();
  const post = await loadPostRecord(db, postId);
  if (!post) throw new NotFoundError("Topic");
  const set =
    action === "pin" ? { is_pinned: true }
    : action === "unpin" ? { is_pinned: false }
    : action === "lock" ? { is_locked: true }
    : action === "unlock" ? { is_locked: false }
    : action === "hide" ? { hidden_at: new Date(), hidden_by: viewer!.id }
    : { hidden_at: null, hidden_by: null };
  await db.update(forumPosts).set(set).where(eq(forumPosts.id, post.id));
}

export async function hideForumComment(db: DbOrTx, viewer: Viewer | null, commentId: string): Promise<string> {
  if (!canModerateForum(viewer)) throw new ForbiddenError();
  const comment = await loadCommentRecord(db, commentId);
  if (!comment) throw new NotFoundError("Comment");
  await db.transaction(async (tx) => {
    await tx
      .update(forumComments)
      .set({ hidden_at: new Date(), hidden_by: viewer!.id })
      .where(and(eq(forumComments.id, comment.id), isNull(forumComments.hidden_at)));
    await recountComments(tx, comment.post_id);
  });
  return comment.post_id;
}

// --- Complaints: same reasons and rules as for story comments — anyone
// signed in (blocked included), never about their own words.

export async function reportForumItem(
  db: DbOrTx,
  viewer: Viewer | null,
  target: { postId?: string; commentId?: string },
  reason: string,
  details?: string
): Promise<void> {
  if (!isValidReportReason(reason)) throw new ForumInputError("body");
  let values: { post_id: string | null; comment_id: string | null };
  if (target.commentId) {
    const comment = await loadCommentRecord(db, target.commentId);
    if (!comment) throw new NotFoundError("Comment");
    const post = await loadPostRecord(db, comment.post_id);
    if (!post || !canViewForumItem(viewer, post) || !canReportForumItem(viewer, comment)) throw new ForbiddenError();
    values = { post_id: null, comment_id: comment.id };
  } else {
    const post = await loadPostRecord(db, target.postId ?? "");
    if (!post) throw new NotFoundError("Topic");
    if (!canReportForumItem(viewer, post)) throw new ForbiddenError();
    values = { post_id: post.id, comment_id: null };
  }
  // A second complaint from the same person about the same thing is a no-op.
  await db
    .insert(forumReports)
    .values({ ...values, reporter_id: viewer!.id, reason, details: details?.trim() || null })
    .onConflictDoNothing();
}

const reportedComment = alias(forumComments, "reported_comment");
const commentPost = alias(forumPosts, "comment_post");
const reportReporter = alias(profiles, "forum_report_reporter");
const reportResolver = alias(profiles, "forum_report_resolver");
const itemAuthor = alias(profiles, "forum_item_author");

function reportSelect(db: DbOrTx) {
  return db
    .select({
      id: forumReports.id,
      reason: forumReports.reason,
      details: forumReports.details,
      status: forumReports.status,
      resolution: forumReports.resolution,
      created_at: forumReports.created_at,
      resolved_at: forumReports.resolved_at,
      comment_id: forumReports.comment_id,
      post_id: sql<string>`coalesce(${forumReports.post_id}, ${reportedComment.post_id})`,
      post_title: sql<string>`coalesce(${forumPosts.title}, ${commentPost.title})`,
      text: sql<string>`coalesce(${reportedComment.body}, ${forumPosts.body})`,
      hidden: sql<boolean>`(coalesce(${reportedComment.hidden_at}, ${forumPosts.hidden_at}) is not null)`,
      author_username: itemAuthor.username,
      author_role: itemAuthor.role,
      reporter_username: reportReporter.username,
      resolver_username: reportResolver.username,
    })
    .from(forumReports)
    .leftJoin(forumPosts, eq(forumPosts.id, forumReports.post_id))
    .leftJoin(reportedComment, eq(reportedComment.id, forumReports.comment_id))
    .leftJoin(commentPost, eq(commentPost.id, reportedComment.post_id))
    .innerJoin(itemAuthor, eq(itemAuthor.id, sql`coalesce(${reportedComment.author_id}, ${forumPosts.author_id})`))
    .innerJoin(reportReporter, eq(reportReporter.id, forumReports.reporter_id))
    .leftJoin(reportResolver, eq(reportResolver.id, forumReports.resolved_by));
}

export type ForumReportRow = Awaited<ReturnType<ReturnType<typeof reportSelect>["execute"]>>[number];

export async function listOpenForumReports(db: DbOrTx, viewer: Viewer | null): Promise<ForumReportRow[]> {
  if (!canModerateForum(viewer)) throw new ForbiddenError();
  return reportSelect(db).where(eq(forumReports.status, "open")).orderBy(asc(forumReports.created_at));
}

export async function listResolvedForumReports(db: DbOrTx, viewer: Viewer | null, limit = 200): Promise<ForumReportRow[]> {
  if (!canModerateForum(viewer)) throw new ForbiddenError();
  return reportSelect(db).where(ne(forumReports.status, "open")).orderBy(desc(forumReports.resolved_at)).limit(limit);
}

export async function countOpenForumReports(db: DbOrTx): Promise<number> {
  const [{ total }] = await db.select({ total: count() }).from(forumReports).where(eq(forumReports.status, "open"));
  return total;
}

export async function resolveForumReport(db: DbOrTx, viewer: Viewer | null, reportId: string, action: ReportAction): Promise<void> {
  if (!canModerateForum(viewer)) throw new ForbiddenError();
  if (!isUuid(reportId)) throw new NotFoundError("Report");

  await db.transaction(async (tx) => {
    // Locked so two moderators deciding at once can't both apply an action.
    const [report] = await tx
      .select({ id: forumReports.id, post_id: forumReports.post_id, comment_id: forumReports.comment_id, status: forumReports.status })
      .from(forumReports)
      .where(eq(forumReports.id, reportId))
      .for("update")
      .limit(1);
    if (!report) throw new NotFoundError("Report");
    if (report.status !== "open") throw new AlreadyResolvedError();

    if (action === "hide") {
      if (report.comment_id) await hideForumComment(tx, viewer, report.comment_id);
      else if (report.post_id) await moderateForumPost(tx, viewer, report.post_id, "hide");
    } else if (action === "block") {
      const authorId = report.comment_id
        ? (await loadCommentRecord(tx, report.comment_id))?.author_id
        : (await loadPostRecord(tx, report.post_id ?? ""))?.author_id;
      if (!authorId) throw new NotFoundError("Author");
      const [author] = await tx.select({ id: profiles.id, role: profiles.role }).from(profiles).where(eq(profiles.id, authorId)).limit(1);
      if (!author || !canChangeUserStatus(viewer, author)) throw new ForbiddenError();
      await tx.update(profiles).set({ status: "blocked" }).where(eq(profiles.id, author.id));
    }

    await tx
      .update(forumReports)
      .set({
        status: action === "dismiss" ? "dismissed" : "actioned",
        resolution: action,
        resolved_at: new Date(),
        resolved_by: viewer!.id,
      })
      .where(eq(forumReports.id, report.id));
  });
}

// --- Links from elsewhere on the site

// «Soʻrov boʻyicha» badge on a story: the request topic it was offered in.
export async function getSorovPostIdForStory(db: DbOrTx, storyId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: forumPosts.id })
    .from(forumComments)
    .innerJoin(forumPosts, eq(forumPosts.id, forumComments.post_id))
    .where(
      and(
        eq(forumComments.story_id, storyId),
        isNull(forumComments.hidden_at),
        eq(forumPosts.category, "sorov"),
        isNull(forumPosts.hidden_at)
      )
    )
    .limit(1);
  return row?.id ?? null;
}

// Old /board?selected=<request id> links → the topic that request became.
export async function getForumPostIdByLegacyRequest(db: DbOrTx, requestId: string): Promise<string | null> {
  if (!isUuid(requestId)) return null;
  const [row] = await db.select({ id: forumPosts.id }).from(forumPosts).where(eq(forumPosts.legacy_request_id, requestId)).limit(1);
  return row?.id ?? null;
}
