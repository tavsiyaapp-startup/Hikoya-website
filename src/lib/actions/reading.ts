"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  } catch {
    // best-effort
  }
}
