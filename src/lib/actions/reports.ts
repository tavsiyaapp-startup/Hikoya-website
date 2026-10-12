"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { loadViewer } from "@/server/data/viewer";
import { reportComment as reportCommentData, resolveReport } from "@/server/data/comments";
import { ForbiddenError, NotFoundError } from "@/server/data/errors";
import { getStaffSession } from "@/server/auth/staff";
import { takeRateLimit } from "@/server/rate-limit";
import type { ReportAction } from "@/server/data/logic";
import { ROUTES } from "@/lib/constants";

const MAX_DETAILS_LENGTH = 500;
const REPORTS_PER_HOUR = 20;

export type ReportCommentResult =
  | { ok: true }
  | { error: "unauthorized" | "not_allowed" | "invalid" | "rate_limited" | "failed" };

// Complaint about a comment. Any signed-in account may report — including a
// blocked one (blocked users keep support chat and complaints) — but never
// their own comment, and only one that is visible to them; the rules live in
// server/data/comments.ts + authz/policy.ts. Reporting the same comment twice
// is a no-op that still answers ok.
export async function reportComment(commentId: string, reason: string, details?: string): Promise<ReportCommentResult> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return { error: "unauthorized" };
  if (typeof commentId !== "string" || typeof reason !== "string") return { error: "invalid" };
  const cleanDetails = typeof details === "string" ? details.trim().slice(0, MAX_DETAILS_LENGTH) : undefined;

  const db = getDb();
  const viewer = await loadViewer(db, session.user.id);
  if (!viewer) return { error: "unauthorized" };
  if (!takeRateLimit(`report:${viewer.id}`, REPORTS_PER_HOUR, 60 * 60 * 1000)) return { error: "rate_limited" };

  try {
    await reportCommentData(db, viewer, commentId, reason, cleanDetails);
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) return { error: "not_allowed" };
    if (err instanceof Error && err.message === "Invalid reason") return { error: "invalid" };
    console.error("[reports] reportComment failed", commentId, err);
    return { error: "failed" };
  }

  revalidatePath(ROUTES.adminReports);
  return { ok: true };
}

const ACTIONS: readonly string[] = ["dismiss", "hide", "block"];

// Staff decision on one complaint: dismiss it, hide the comment, or block
// the comment's author. A moderator can't block an admin (policy.ts
// canChangeUserStatus) — that comes back as not_allowed.
export async function resolveCommentReport(
  reportId: string,
  action: ReportAction
): Promise<{ ok: true } | { error: "unauthorized" | "not_allowed" | "failed" }> {
  const staff = await getStaffSession();
  if (staff.status !== "staff") return { error: "unauthorized" };
  if (typeof reportId !== "string" || !ACTIONS.includes(action)) return { error: "not_allowed" };

  const db = getDb();
  const viewer = await loadViewer(db, staff.staff.id);
  try {
    await resolveReport(db, viewer, reportId, action);
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) return { error: "not_allowed" };
    console.error("[reports] resolveReport failed", reportId, action, err);
    return { error: "failed" };
  }

  revalidatePath(ROUTES.adminReports);
  revalidatePath(ROUTES.admin, "layout");
  return { ok: true };
}
