"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROUTES } from "@/lib/constants";
import type { ReadingStatus } from "@/types/database";

// Called once per chapter view from the client. View counters are bumped
// with the admin client (RLS has no public "increment" story of write access
// to view_count) — reading progress uses the user's own session so RLS still
// applies there.
export async function recordChapterView(input: {
  chapterId: string;
  storyId: string;
  orderIndex: number;
  totalChapters: number;
}) {
  try {
    const admin = createAdminClient();
    await admin.rpc("increment_view_counts", {
      p_chapter_id: input.chapterId,
      p_story_id: input.storyId,
    });
  } catch {
    // best-effort — view counts are not load-bearing
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

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

    // First visit marks this specific chapter as read; later visits to the
    // same chapter are no-ops (chapter_reads is insert-only, nothing to
    // update) — separate from reading_progress above, which only tracks the
    // *latest* chapter per story.
    await supabase.from("chapter_reads").upsert(
      { user_id: user.id, chapter_id: input.chapterId, story_id: input.storyId },
      { onConflict: "user_id,chapter_id", ignoreDuplicates: true }
    );
  } catch {
    // best-effort
  }
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
