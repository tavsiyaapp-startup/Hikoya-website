"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function toggleStoryLike(storyId: string, path: string) {
  const { supabase, user } = await requireUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("target_type", "story")
    .eq("target_id", storyId)
    .maybeSingle();

  if (existing) {
    await supabase.from("likes").delete().eq("id", existing.id);
  } else {
    await supabase.from("likes").insert({ user_id: user.id, target_type: "story", target_id: storyId });
  }
  revalidatePath(path);
}

export async function toggleStoryBookmark(storyId: string, path: string) {
  const { supabase, user } = await requireUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", user.id)
    .eq("story_id", storyId)
    .maybeSingle();

  if (existing) {
    await supabase.from("bookmarks").delete().eq("id", existing.id);
  } else {
    await supabase.from("bookmarks").insert({ user_id: user.id, story_id: storyId });
  }
  revalidatePath(path);
}

export async function toggleFollowAuthor(authorId: string, path: string) {
  const { supabase, user } = await requireUser();
  if (!user || user.id === authorId) return;

  const { data: existing } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("author_id", authorId)
    .maybeSingle();

  if (existing) {
    await supabase.from("follows").delete().eq("id", existing.id);
  } else {
    await supabase.from("follows").insert({ follower_id: user.id, author_id: authorId });
  }
  revalidatePath(path);
}

export async function postComment(chapterId: string, text: string, path: string) {
  const { supabase, user } = await requireUser();
  if (!user || !text.trim()) return;

  await supabase.from("comments").insert({ chapter_id: chapterId, user_id: user.id, text: text.trim() });
  revalidatePath(path);
}
