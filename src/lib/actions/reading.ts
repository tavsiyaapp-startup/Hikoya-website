"use server";

import { revalidatePath } from "next/cache";
import { revalidateClientPath } from "@/lib/revalidate-client-path";
import { cookies, headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { getAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { chapterReads, chapters, readingProgress, readingStatuses, stories } from "@/server/db/schema";
import { ROUTES, GUEST_READ_COOKIE } from "@/lib/constants";
import { loadViewer } from "@/server/data/viewer";
import { getStoryRecord } from "@/server/data/stories";
import { canViewChapter, canViewStory } from "@/server/authz/policy";
import type { ReadingStatus } from "@/types/database";

const GUEST_READ_MAX_CHAPTERS = 50;
const GUEST_READ_MAX_STORIES = 30;

type GuestReads = { c: string[]; s: string[] };

function parseGuestReads(raw: string | undefined): GuestReads {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      c: Array.isArray(parsed?.c) ? parsed.c : [],
      s: Array.isArray(parsed?.s) ? parsed.s : [],
    };
  } catch {
    return { c: [], s: [] };
  }
}

// Used to go through a Postgres RPC (increment_view_counts) specifically so
// the admin/service-role client could write view_count without a public RLS
// write policy on it — moot now, this file's own Drizzle/pg connection never
// went through RLS at all, so a plain UPDATE does the same job directly.
async function bumpViewCounts(chapterId: string, storyId: string, bumpStory: boolean) {
  const db = getDb();
  await db
    .update(chapters)
    .set({ view_count: sql`${chapters.view_count} + 1` })
    .where(eq(chapters.id, chapterId));
  if (bumpStory) {
    await db
      .update(stories)
      .set({ view_count: sql`${stories.view_count} + 1` })
      .where(eq(stories.id, storyId));
  }
}

// Resolves everything the view counter needs from the database instead of
// trusting the client: the chapter must exist, belong to the story it claims,
// and be readable by this viewer; its position and the story's chapter count
// come from the rows themselves. Before this, any caller could bump any
// story's or chapter's view_count (or write reading progress for a draft)
// by sending made-up ids and numbers.
async function resolveViewedChapter(chapterId: string, storyId: string, userId: string | undefined) {
  const db = getDb();
  const [chapter] = await db
    .select({ id: chapters.id, story_id: chapters.story_id, status: chapters.status, order_index: chapters.order_index })
    .from(chapters)
    .where(eq(chapters.id, chapterId))
    .limit(1);
  if (!chapter || chapter.story_id !== storyId) return null;
  const [viewer, story] = await Promise.all([loadViewer(db, userId), getStoryRecord(db, chapter.story_id)]);
  if (!story || !canViewChapter(viewer, chapter, story)) return null;
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(chapters)
    .where(and(eq(chapters.story_id, story.id), eq(chapters.status, "published")));
  return { chapterId: chapter.id, storyId: story.id, orderIndex: chapter.order_index, totalChapters: total };
}

// Called once per chapter view from the client. View counters only count
// unique readers — a reader who reloads/revisits a chapter they've already
// been counted for doesn't bump it again, and a story's counter only grows
// on that reader's first-ever chapter read of that story (not once per
// chapter). Logged-in readers are deduped via chapter_reads (insert-only,
// one row per user+chapter); guests have no profile row to key off, so
// they're deduped via a cookie listing chapter/story ids already counted
// for that browser. Only chapterId/storyId are taken from the client (and
// verified); orderIndex/totalChapters are kept in the signature for the
// existing caller but ignored.
export async function recordChapterView(raw: {
  chapterId: string;
  storyId: string;
  orderIndex?: number;
  totalChapters?: number;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  const userId = session?.user.id;

  let input: Awaited<ReturnType<typeof resolveViewedChapter>>;
  try {
    if (typeof raw?.chapterId !== "string" || typeof raw?.storyId !== "string") return;
    input = await resolveViewedChapter(raw.chapterId, raw.storyId, userId);
  } catch (err) {
    console.error("[reading] resolving viewed chapter failed", err);
    return;
  }
  if (!input) return;

  if (userId) {
    const db = getDb();
    try {
      const [existingStoryRead] = await db
        .select({ chapter_id: chapterReads.chapter_id })
        .from(chapterReads)
        .where(and(eq(chapterReads.user_id, userId), eq(chapterReads.story_id, input.storyId)))
        .limit(1);

      // First visit inserts and marks this specific chapter as read; later
      // visits to the same chapter are no-ops (onConflictDoNothing), and
      // that absence of a returned row is exactly the "not new" signal used
      // below to skip the view bump.
      const [newRead] = await db
        .insert(chapterReads)
        .values({ user_id: userId, chapter_id: input.chapterId, story_id: input.storyId })
        .onConflictDoNothing({ target: [chapterReads.user_id, chapterReads.chapter_id] })
        .returning({ chapter_id: chapterReads.chapter_id });

      if (newRead) {
        await bumpViewCounts(input.chapterId, input.storyId, !existingStoryRead);
      }
    } catch (err) {
      // best-effort — view counts are not load-bearing
      console.error("[reading] recording chapter read failed", err);
    }

    try {
      const percent = Math.min(100, Math.round((input.orderIndex / Math.max(1, input.totalChapters)) * 100));
      await db
        .insert(readingProgress)
        .values({ user_id: userId, story_id: input.storyId, chapter_id: input.chapterId, percent: String(percent) })
        .onConflictDoUpdate({
          target: [readingProgress.user_id, readingProgress.story_id],
          set: { chapter_id: input.chapterId, percent: String(percent), updated_at: new Date() },
        });
    } catch (err) {
      // best-effort
      console.error("[reading] saving reading progress failed", err);
    }
    return;
  }

  try {
    const cookieStore = await cookies();
    const reads = parseGuestReads(cookieStore.get(GUEST_READ_COOKIE)?.value);
    const chapterIds = new Set(reads.c);
    if (!chapterIds.has(input.chapterId)) {
      const storyIds = new Set(reads.s);
      await bumpViewCounts(input.chapterId, input.storyId, !storyIds.has(input.storyId));

      chapterIds.add(input.chapterId);
      storyIds.add(input.storyId);
      const capped: GuestReads = {
        c: [...chapterIds].slice(-GUEST_READ_MAX_CHAPTERS),
        s: [...storyIds].slice(-GUEST_READ_MAX_STORIES),
      };
      cookieStore.set(GUEST_READ_COOKIE, JSON.stringify(capped), {
        maxAge: 60 * 60 * 24 * 365,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }
  } catch (err) {
    // best-effort — view counts are not load-bearing
    console.error("[reading] recording guest view failed", err);
  }
}

const READING_STATUSES: readonly string[] = ["want_to_read", "read", "dropped"];

// Returns false if refused (signed out, unknown status, story not visible).
export async function setReadingStatus(storyId: string, status: ReadingStatus | null, path: string): Promise<boolean> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  const userId = session?.user.id;
  if (!userId) return false;

  const db = getDb();
  if (status !== null) {
    if (!READING_STATUSES.includes(status)) return false;
    const [viewer, story] = await Promise.all([loadViewer(db, userId), getStoryRecord(db, storyId)]);
    if (!story || !canViewStory(viewer, story)) return false;
  }
  if (status === null) {
    await db.delete(readingStatuses).where(and(eq(readingStatuses.user_id, userId), eq(readingStatuses.story_id, storyId)));
  } else {
    await db
      .insert(readingStatuses)
      .values({ user_id: userId, story_id: storyId, status })
      .onConflictDoUpdate({
        target: [readingStatuses.user_id, readingStatuses.story_id],
        set: { status, updated_at: new Date() },
      });
  }

  revalidateClientPath(path);
  revalidatePath(ROUTES.library);
  return true;
}
