"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
import { getAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { requestResponses, requests } from "@/server/db/schema";
import { loadViewer } from "@/server/data/viewer";
import { getStoryRecord } from "@/server/data/stories";
import { canCloseRequest, canLinkStoryToRequest, isActive } from "@/server/authz/policy";
import { ROUTES } from "@/lib/constants";

async function requireViewer() {
  const db = getDb();
  const session = await getAuth().api.getSession({ headers: await headers() });
  const viewer = await loadViewer(db, session?.user.id);
  if (!viewer) redirect(ROUTES.onboarding);
  return { db, viewer };
}

export async function createRequest(formData: FormData) {
  const { db, viewer } = await requireViewer();
  if (!isActive(viewer)) return;

  const title = String(formData.get("title") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  if (!title || !text) return;

  await db.insert(requests).values({ from_user_id: viewer.id, title, text });

  revalidatePath(ROUTES.board);
}

export async function respondToRequest(requestId: string, formData: FormData) {
  const { db, viewer } = await requireViewer();
  if (!isActive(viewer)) return;

  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;

  const rawStoryId = String(formData.get("storyId") ?? "").trim();
  let storyId: string | null = null;
  if (rawStoryId) {
    const story = await getStoryRecord(db, rawStoryId);
    if (story && canLinkStoryToRequest(viewer, story)) storyId = story.id;
  }

  await db.insert(requestResponses).values({ request_id: requestId, author_id: viewer.id, text, story_id: storyId });
  await db.update(requests).set({ status: "in_progress" }).where(and(eq(requests.id, requestId), eq(requests.status, "open")));

  revalidatePath(ROUTES.board);
}

// Only the requester who opened it can close their own request (staff use
// the separate admin action, which also allows reopening/deleting).
export async function closeRequest(requestId: string) {
  const { db, viewer } = await requireViewer();

  const [request] = await db
    .select({ id: requests.id, from_user_id: requests.from_user_id })
    .from(requests)
    .where(eq(requests.id, requestId))
    .limit(1);
  if (!request || !canCloseRequest(viewer, request)) return;

  await db.update(requests).set({ status: "closed" }).where(and(eq(requests.id, requestId), ne(requests.status, "closed")));

  revalidatePath(ROUTES.board);
}
