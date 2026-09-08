"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

// Called once per chapter view from the client. View counters only count
// unique readers — a reader who reloads/revisits a chapter they've already
// been counted for doesn't bump it again, and a story's counter only grows
// on that reader's first-ever chapter read of that story (not once per
// chapter). Logged-in readers are deduped via chapter_reads (insert-only,
// one row per user+chapter); guests have no profile row to key off, so
// they're deduped via a cookie listing chapter/story ids already counted
// for that browser. View bumps go through the admin client (view_count has
// no public RLS write policy on purpose) — reading progress uses the user's
// own session so RLS still applies there.
export async function recordChapterView(input: {
  chapterId: string;
  storyId: string;
  orderIndex: number;
  totalChapters: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      const { data: existingStoryRead } = await supabase
        .from("chapter_reads")
        .select("chapter_id")
        .eq("user_id", user.id)
        .eq("story_id", input.storyId)
        .limit(1)
        .maybeSingle();

      // First visit inserts and marks this specific chapter as read; later
      // visits to the same chapter are no-ops (ignoreDuplicates), and that
      // absence of a returned row is exactly the "not new" signal used
      // below to skip the view bump.
      const { data: newRead } = await supabase
        .from("chapter_reads")
        .upsert(
          { user_id: user.id, chapter_id: input.chapterId, story_id: input.storyId },
          { onConflict: "user_id,chapter_id", ignoreDuplicates: true }
        )
        .select("chapter_id")
        .maybeSingle();

      if (newRead) {
        const admin = createAdminClient();
        await admin.rpc("increment_view_counts", {
          p_chapter_id: input.chapterId,
          p_story_id: input.storyId,
          p_bump_story: !existingStoryRead,
        });
      }
    } catch {
      // best-effort — view counts are not load-bearing
    }

    try {
      const percent = Math.min(100, Math.round((input.orderIndex / Math.max(1, input.totalChapters)) * 100));
      await supabase.from("reading_progress").upsert(
        {
          user_id: user.id,
          story_id: input.storyId,
          chapter_id: input.chapterId,
          percent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,story_id" }
      );
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
      const admin = createAdminClient();
      await admin.rpc("increment_view_counts", {
        p_chapter_id: input.chapterId,
        p_story_id: input.storyId,
        p_bump_story: !storyIds.has(input.storyId),
      });

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

// "Continue reading" (home page) and the "Читаю" tab in /library read from
// the same reading_progress row per (user, story) — removing it here makes
// the story disappear from both, not just the section the button was
// clicked from.
export async function removeFromContinueReading(storyId: string, path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("reading_progress").delete().eq("user_id", user.id).eq("story_id", storyId);

  revalidatePath(path);
  revalidatePath(ROUTES.library);
}

export async function setReadingStatus(storyId: string, status: ReadingStatus | null, path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  if (status === null) {
    await supabase.from("reading_statuses").delete().eq("user_id", user.id).eq("story_id", storyId);
  } else {
    await supabase
      .from("reading_statuses")
      .upsert(
        { user_id: user.id, story_id: storyId, status, updated_at: new Date().toISOString() },
        { onConflict: "user_id,story_id" }
      );
  }

  revalidatePath(path);
  revalidatePath(ROUTES.library);
}
