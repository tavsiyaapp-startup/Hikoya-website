import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
  canChangeUserStatus,
  canCommentOnChapter,
  canCommentOnStory,
  canEditComment,
  canHideComment,
  canLikeComment,
  canReportComment,
  canReviewReports,
  canViewChapter,
  canViewStory,
  isStaff,
  type CommentRecord,
  type Viewer,
} from "@/server/authz/policy";
import type { DbOrTx } from "@/server/db/client";
import { commentReports, comments, likes, profiles } from "@/server/db/schema";
import { ForbiddenError, NotFoundError } from "@/server/data/errors";
import { getChapterRecord, requireViewableChapter } from "@/server/data/chapters";
import { getStoryRecord, requireViewableStory } from "@/server/data/stories";
import { isValidReportReason, type ReportAction, type ReportReason } from "@/server/data/logic";

// Comments hidden by a moderator are excluded for everyone except staff —
// matches "a hidden comment shows a placeholder/disappears for readers,
// staff still sees it" from the complaints feature.
function visibleToViewer(viewer: Viewer | null) {
  return isStaff(viewer) ? undefined : isNull(comments.hidden_at);
}

export async function listChapterComments(db: DbOrTx, viewer: Viewer | null, chapterId: string) {
  await requireViewableChapter(db, viewer, chapterId);
  const extra = visibleToViewer(viewer);
  return db
    .select()
    .from(comments)
    .where(extra ? and(eq(comments.chapter_id, chapterId), extra) : eq(comments.chapter_id, chapterId))
    .orderBy(asc(comments.created_at));
}

// The story page's own "Комментарии" tab: general comments not tied to one chapter.
export async function listStoryComments(db: DbOrTx, viewer: Viewer | null, storyId: string) {
  await requireViewableStory(db, viewer, storyId);
  const extra = visibleToViewer(viewer);
  const base = and(eq(comments.story_id, storyId), isNull(comments.chapter_id));
  return db
    .select()
    .from(comments)
    .where(extra ? and(base, extra) : base)
    .orderBy(asc(comments.created_at));
}

export interface PostCommentInput {
  storyId: string;
  chapterId: string | null;
  text: string;
  parentId?: string;
  isSpoiler?: boolean;
}

export async function postComment(db: DbOrTx, viewer: Viewer | null, input: PostCommentInput) {
  if (!viewer) throw new ForbiddenError();
  const text = input.text.trim();
  if (!text) throw new Error("Text is required");

  if (input.chapterId) {
    const { chapter, story } = await requireViewableChapter(db, viewer, input.chapterId);
    if (chapter.story_id !== input.storyId) throw new Error("Chapter does not belong to story");
    if (!canCommentOnChapter(viewer, chapter, story)) throw new ForbiddenError();
  } else {
    const story = await requireViewableStory(db, viewer, input.storyId);
    if (!canCommentOnStory(viewer, story)) throw new ForbiddenError();
  }

  if (input.parentId) {
    const [parent] = await db
      .select({ id: comments.id, story_id: comments.story_id, hidden_at: comments.hidden_at })
      .from(comments)
      .where(eq(comments.id, input.parentId))
      .limit(1);
    if (!parent || parent.story_id !== input.storyId || parent.hidden_at) throw new NotFoundError("Comment");
  }

  const [comment] = await db
    .insert(comments)
    .values({
      story_id: input.storyId,
      chapter_id: input.chapterId,
      user_id: viewer.id,
      text,
      parent_id: input.parentId ?? null,
      is_spoiler: Boolean(input.isSpoiler),
    })
    .returning();
  return comment;
}

async function loadCommentRecord(db: DbOrTx, commentId: string): Promise<CommentRecord | null> {
  const [row] = await db.select({ id: comments.id, user_id: comments.user_id }).from(comments).where(eq(comments.id, commentId)).limit(1);
  return row ?? null;
}

// Whether a comment is currently visible to this viewer: its chapter or
// story must be visible, and — for non-staff — it must not be hidden.
async function isCommentVisible(db: DbOrTx, viewer: Viewer | null, commentId: string): Promise<boolean> {
  const [row] = await db
    .select({ chapter_id: comments.chapter_id, story_id: comments.story_id, hidden_at: comments.hidden_at })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  if (!row) return false;
  if (row.hidden_at && !isStaff(viewer)) return false;

  const story = await getStoryRecord(db, row.story_id);
  if (!story) return false;
  if (!row.chapter_id) return canViewStory(viewer, story);
  const chapter = await getChapterRecord(db, row.chapter_id);
  return Boolean(chapter) && canViewChapter(viewer, chapter!, story);
}

export async function toggleCommentLike(db: DbOrTx, viewer: Viewer | null, commentId: string): Promise<boolean> {
  const visible = await isCommentVisible(db, viewer, commentId);
  if (!canLikeComment(viewer, visible)) throw new ForbiddenError();

  const [existing] = await db
    .select({ id: likes.id })
    .from(likes)
    .where(and(eq(likes.user_id, viewer!.id), eq(likes.target_type, "comment"), eq(likes.target_id, commentId)))
    .limit(1);

  if (existing) {
    await db.delete(likes).where(eq(likes.id, existing.id));
    return false;
  }
  await db.insert(likes).values({ user_id: viewer!.id, target_type: "comment", target_id: commentId });
  return true;
}

export async function editComment(db: DbOrTx, viewer: Viewer | null, commentId: string, text: string): Promise<void> {
  const comment = await loadCommentRecord(db, commentId);
  if (!comment) throw new NotFoundError("Comment");
  if (!canEditComment(viewer, comment)) throw new ForbiddenError();
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Text is required");
  await db.update(comments).set({ text: trimmed }).where(eq(comments.id, commentId));
}

export async function deleteComment(db: DbOrTx, viewer: Viewer | null, commentId: string): Promise<void> {
  const comment = await loadCommentRecord(db, commentId);
  if (!comment) throw new NotFoundError("Comment");
  if (!canEditComment(viewer, comment)) throw new ForbiddenError();
  await db.delete(comments).where(eq(comments.id, commentId));
}

// --- Complaints: anyone (including a blocked account) can report a visible
// comment that is not their own; staff reviews the queue and decides.

export async function reportComment(
  db: DbOrTx,
  viewer: Viewer | null,
  commentId: string,
  reason: string,
  details?: string
): Promise<void> {
  if (!isValidReportReason(reason)) throw new Error("Invalid reason");
  const comment = await loadCommentRecord(db, commentId);
  if (!comment) throw new NotFoundError("Comment");
  const visible = await isCommentVisible(db, viewer, commentId);
  if (!canReportComment(viewer, comment, visible)) throw new ForbiddenError();

  await db
    .insert(commentReports)
    .values({ comment_id: commentId, reporter_id: viewer!.id, reason, details: details?.trim() || null })
    .onConflictDoNothing({ target: [commentReports.comment_id, commentReports.reporter_id] });
}

const reportAuthor = alias(profiles, "report_author");
const reportReporter = alias(profiles, "report_reporter");

export async function listOpenReports(db: DbOrTx, viewer: Viewer | null) {
  if (!canReviewReports(viewer)) throw new ForbiddenError();
  return db
    .select({
      id: commentReports.id,
      reason: commentReports.reason,
      details: commentReports.details,
      created_at: commentReports.created_at,
      comment_id: comments.id,
      comment_text: comments.text,
      comment_hidden_at: comments.hidden_at,
      story_id: comments.story_id,
      chapter_id: comments.chapter_id,
      author_id: comments.user_id,
      author_username: reportAuthor.username,
      author_role: reportAuthor.role,
      reporter_username: reportReporter.username,
    })
    .from(commentReports)
    .innerJoin(comments, eq(commentReports.comment_id, comments.id))
    .innerJoin(reportAuthor, eq(comments.user_id, reportAuthor.id))
    .innerJoin(reportReporter, eq(commentReports.reporter_id, reportReporter.id))
    .where(eq(commentReports.status, "open"))
    .orderBy(asc(commentReports.created_at));
}

export async function resolveReport(db: DbOrTx, viewer: Viewer | null, reportId: string, action: ReportAction): Promise<void> {
  if (!canReviewReports(viewer)) throw new ForbiddenError();

  await db.transaction(async (tx) => {
    const [report] = await tx
      .select({ id: commentReports.id, comment_id: commentReports.comment_id, status: commentReports.status })
      .from(commentReports)
      .where(eq(commentReports.id, reportId))
      .limit(1);
    if (!report) throw new NotFoundError("Report");
    if (report.status !== "open") return; // already resolved by someone else

    if (action === "hide") {
      if (!canHideComment(viewer)) throw new ForbiddenError();
      await tx.update(comments).set({ hidden_at: new Date(), hidden_by: viewer!.id }).where(eq(comments.id, report.comment_id));
    } else if (action === "block") {
      const [row] = await tx
        .select({ author_id: comments.user_id, author_role: profiles.role })
        .from(comments)
        .innerJoin(profiles, eq(comments.user_id, profiles.id))
        .where(eq(comments.id, report.comment_id))
        .limit(1);
      if (!row) throw new NotFoundError("Comment");
      if (!canChangeUserStatus(viewer, { id: row.author_id, role: row.author_role })) throw new ForbiddenError();
      await tx.update(profiles).set({ status: "blocked" }).where(eq(profiles.id, row.author_id));
    }
    // "dismiss" has no side effect beyond closing the report below.

    await tx
      .update(commentReports)
      .set({ status: action === "dismiss" ? "dismissed" : "actioned", resolved_at: new Date(), resolved_by: viewer!.id })
      .where(eq(commentReports.id, reportId));
  });
}

export type { ReportReason };
