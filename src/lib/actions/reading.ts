"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { getAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { chapterReads, chapters, readingProgress, readingStatuses, stories } from "@/server/db/schema";
import { ROUTES, GUEST_READ_COOKIE } from "@/lib/constants";
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

// Called once per chapter view from the client. View counters only count
// unique readers — a reader who reloads/revisits a chapter they've already
// been counted for doesn't bump it again, and a story's counter only grows
// on that reader's first-ever chapter read of that story (not once per
// chapter). Logged-in readers are deduped via chapter_reads (insert-only,
// one row per user+chapter); guests have no profile row to key off, so
// they're deduped via a cookie listing chapter/story ids already counted
// for that browser.
export async function recordChapterView(input: {
  chapterId: string;
  storyId: string;
  orderIndex: number;
  totalChapters: number;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  const userId = session?.user.id;

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
    } catch {
      // best-effort — view counts are not load-bearing
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
    } catch {
      // best-effort
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
  } catch {
    // best-effort — view counts are not load-bearing
  }
}

export async function setReadingStatus(storyId: string, status: ReadingStatus | null, path: string) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  const userId = session?.user.id;
  if (!userId) return;

  const db = getDb();
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

  revalidatePath(path);
  revalidatePath(ROUTES.library);
}
