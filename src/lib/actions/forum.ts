"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getAuth } from "@/server/auth/config";
import { getStaffSession } from "@/server/auth/staff";
import { getDb } from "@/server/db/client";
import { loadViewer } from "@/server/data/viewer";
import { AlreadyResolvedError, ForbiddenError, NotFoundError } from "@/server/data/errors";
import { isActive, type Viewer } from "@/server/authz/policy";
import { takeRateLimit } from "@/server/rate-limit";
import { createNotification } from "@/lib/actions/create-notification";
import { isValidReportReason, type ReportAction } from "@/server/data/logic";
import {
  FORUM_MODERATIONS,
  ForumInputError,
  createForumComment,
  createForumPost,
  deleteForumComment,
  deleteForumPost,
  hideForumComment,
  moderateForumPost,
  reportForumItem,
  resolveForumReport,
  toggleForumCommentLike,
  toggleForumVote,
  type ForumModeration,
} from "@/server/data/forum";
import { ROUTES } from "@/lib/constants";

// Server actions behind Muhokamalar. Each returns a small result object the
// client turns into a message; the rules themselves live in
// src/server/data/forum.ts and src/server/authz/policy.ts.

const TOPICS_PER_DAY = 5;
const COMMENTS_PER_DAY = 200;
const COMMENT_EVERY_MS = 10_000;
const REPORTS_PER_HOUR = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

type Failure = "unauthorized" | "blocked" | "rate_limited" | "not_allowed" | "failed";
export type ForumPostResult = { ok: true; id: string } | { error: Failure | "title" | "body" | "story" | "category" };
export type ForumCommentResult = { ok: true } | { error: Failure | "body" | "story" | "too_fast" };
export type ForumSimpleResult = { ok: true } | { error: Failure | "already_resolved" };

async function currentViewer(): Promise<Viewer | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return loadViewer(getDb(), session?.user.id);
}

function refreshForum(postId?: string) {
  revalidatePath(ROUTES.forum);
  if (postId) revalidatePath(ROUTES.forumPost(postId));
}

export async function createForumPostAction(input: {
  category: string;
  title: string;
  body: string;
  storyRef?: string;
}): Promise<ForumPostResult> {
  const viewer = await currentViewer();
  if (!viewer) return { error: "unauthorized" };
  if (!isActive(viewer)) return { error: "blocked" };
  if (!takeRateLimit(`forum-topic:${viewer.id}`, TOPICS_PER_DAY, DAY_MS)) return { error: "rate_limited" };

  try {
    const id = await createForumPost(getDb(), viewer, {
      category: String(input.category ?? ""),
      title: String(input.title ?? ""),
      body: String(input.body ?? ""),
      storyRef: typeof input.storyRef === "string" ? input.storyRef : undefined,
    });
    refreshForum();
    return { ok: true, id };
  } catch (err) {
    if (err instanceof ForumInputError) return { error: err.code };
    if (err instanceof ForbiddenError) return { error: "not_allowed" };
    console.error("[forum] createForumPost failed", err);
    return { error: "failed" };
  }
}

export async function postForumComment(
  postId: string,
  body: string,
  parentId?: string | null,
  storyId?: string | null
): Promise<ForumCommentResult> {
  const viewer = await currentViewer();
  if (!viewer) return { error: "unauthorized" };
  if (!isActive(viewer)) return { error: "blocked" };
  if (!takeRateLimit(`forum-comment-burst:${viewer.id}`, 1, COMMENT_EVERY_MS)) return { error: "too_fast" };
  if (!takeRateLimit(`forum-comment-day:${viewer.id}`, COMMENTS_PER_DAY, DAY_MS)) return { error: "rate_limited" };

  try {
    const created = await createForumComment(getDb(), viewer, {
      postId: String(postId),
      body: String(body ?? ""),
      parentId: parentId ? String(parentId) : null,
      storyId: storyId ? String(storyId) : null,
    });
    refreshForum(created.postId);

    // The person answered hears about the reply; the topic's author hears
    // about any other comment in their topic (once, not twice).
    if (created.repliedToAuthorId) {
      await createNotification({
        userId: created.repliedToAuthorId,
        actorId: viewer.id,
        type: "forum_reply",
        forumPostId: created.postId,
        forumCommentId: created.id,
      });
    }
    if (created.postAuthorId !== created.repliedToAuthorId) {
      await createNotification({
        userId: created.postAuthorId,
        actorId: viewer.id,
        type: "forum_comment",
        forumPostId: created.postId,
        forumCommentId: created.id,
      });
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof ForumInputError) return { error: err.code === "story" ? "story" : "body" };
    if (err instanceof ForbiddenError || err instanceof NotFoundError) return { error: "not_allowed" };
    console.error("[forum] createForumComment failed", postId, err);
    return { error: "failed" };
  }
}

// Toggles return the settled state, or null when refused (signed out,
// blocked, own topic...) so the optimistic button can roll back.
export async function toggleForumVoteAction(postId: string): Promise<{ voted: boolean; count: number } | null> {
  const viewer = await currentViewer();
  if (!viewer) return null;
  try {
    const result = await toggleForumVote(getDb(), viewer, String(postId));
    refreshForum(String(postId));
    return result;
  } catch (err) {
    if (!(err instanceof ForbiddenError || err instanceof NotFoundError)) console.error("[forum] vote failed", postId, err);
    return null;
  }
}

export async function toggleForumCommentLikeAction(commentId: string): Promise<{ liked: boolean; count: number } | null> {
  const viewer = await currentViewer();
  if (!viewer) return null;
  try {
    return await toggleForumCommentLike(getDb(), viewer, String(commentId));
  } catch (err) {
    if (!(err instanceof ForbiddenError || err instanceof NotFoundError)) console.error("[forum] like failed", commentId, err);
    return null;
  }
}

function simpleError(err: unknown, what: string): ForumSimpleResult {
  if (err instanceof AlreadyResolvedError) return { error: "already_resolved" };
  if (err instanceof ForbiddenError || err instanceof NotFoundError) return { error: "not_allowed" };
  console.error(`[forum] ${what} failed`, err);
  return { error: "failed" };
}

export async function deleteForumPostAction(postId: string): Promise<ForumSimpleResult> {
  const viewer = await currentViewer();
  if (!viewer) return { error: "unauthorized" };
  try {
    await deleteForumPost(getDb(), viewer, String(postId));
    refreshForum(String(postId));
    return { ok: true };
  } catch (err) {
    return simpleError(err, "deleteForumPost");
  }
}

export async function deleteForumCommentAction(commentId: string): Promise<ForumSimpleResult> {
  const viewer = await currentViewer();
  if (!viewer) return { error: "unauthorized" };
  try {
    const postId = await deleteForumComment(getDb(), viewer, String(commentId));
    refreshForum(postId);
    return { ok: true };
  } catch (err) {
    return simpleError(err, "deleteForumComment");
  }
}

export async function moderateForumPostAction(postId: string, action: ForumModeration): Promise<ForumSimpleResult> {
  const viewer = await currentViewer();
  if (!viewer) return { error: "unauthorized" };
  if (!FORUM_MODERATIONS.includes(action)) return { error: "not_allowed" };
  try {
    await moderateForumPost(getDb(), viewer, String(postId), action);
    refreshForum(String(postId));
    return { ok: true };
  } catch (err) {
    return simpleError(err, "moderateForumPost");
  }
}

export async function hideForumCommentAction(commentId: string): Promise<ForumSimpleResult> {
  const viewer = await currentViewer();
  if (!viewer) return { error: "unauthorized" };
  try {
    const postId = await hideForumComment(getDb(), viewer, String(commentId));
    refreshForum(postId);
    return { ok: true };
  } catch (err) {
    return simpleError(err, "hideForumComment");
  }
}

export type ForumReportResult = { ok: true } | { error: "unauthorized" | "not_allowed" | "invalid" | "rate_limited" | "failed" };

// Blocked accounts may still complain (owner's rule), so no isActive here.
export async function reportForumItemAction(
  target: { postId?: string; commentId?: string },
  reason: string,
  details?: string
): Promise<ForumReportResult> {
  const viewer = await currentViewer();
  if (!viewer) return { error: "unauthorized" };
  if (typeof reason !== "string" || !isValidReportReason(reason)) return { error: "invalid" };
  if (!takeRateLimit(`report:${viewer.id}`, REPORTS_PER_HOUR, 60 * 60 * 1000)) return { error: "rate_limited" };
  try {
    await reportForumItem(
      getDb(),
      viewer,
      { postId: target?.postId ? String(target.postId) : undefined, commentId: target?.commentId ? String(target.commentId) : undefined },
      reason,
      typeof details === "string" ? details.slice(0, 500) : undefined
    );
    revalidatePath(ROUTES.adminForum);
    return { ok: true };
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof NotFoundError || err instanceof ForumInputError) return { error: "not_allowed" };
    console.error("[forum] report failed", err);
    return { error: "failed" };
  }
}

const REPORT_ACTIONS: readonly string[] = ["dismiss", "hide", "block"];

export async function resolveForumReportAction(reportId: string, action: ReportAction): Promise<ForumSimpleResult> {
  const staff = await getStaffSession();
  if (staff.status !== "staff") return { error: "unauthorized" };
  if (!REPORT_ACTIONS.includes(action)) return { error: "not_allowed" };
  const db = getDb();
  try {
    await resolveForumReport(db, await loadViewer(db, staff.staff.id), String(reportId), action);
    revalidatePath(ROUTES.adminForum);
    revalidatePath(ROUTES.admin, "layout");
    refreshForum();
    return { ok: true };
  } catch (err) {
    return simpleError(err, "resolveForumReport");
  }
}
