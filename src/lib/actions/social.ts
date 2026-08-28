"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/actions/create-notification";

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
    const { error } = await supabase.from("likes").delete().eq("id", existing.id);
    if (error) console.error("toggleStoryLike failed:", error);
    revalidatePath(path);
    return;
  }

  const { error } = await supabase
    .from("likes")
    .insert({ user_id: user.id, target_type: "story", target_id: storyId });
  if (error) {
    console.error("toggleStoryLike failed:", error);
    revalidatePath(path);
    return;
  }

  const { data: story } = await supabase.from("stories").select("author_id").eq("id", storyId).single();
  if (story && story.author_id !== user.id) {
    await createNotification({ userId: story.author_id, actorId: user.id, type: "story_like", storyId });
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

  const { error } = existing
    ? await supabase.from("bookmarks").delete().eq("id", existing.id)
    : await supabase.from("bookmarks").insert({ user_id: user.id, story_id: storyId });
  if (error) console.error("toggleStoryBookmark failed:", error);
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

  const { error } = existing
    ? await supabase.from("follows").delete().eq("id", existing.id)
    : await supabase.from("follows").insert({ follower_id: user.id, author_id: authorId });
  if (error) console.error("toggleFollowAuthor failed:", error);
  revalidatePath(path);
}

export async function postComment(
  chapterId: string,
  text: string,
  path: string,
  parentId?: string,
  isSpoiler?: boolean
) {
  const { supabase, user } = await requireUser();
  if (!user || !text.trim()) return;

  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      chapter_id: chapterId,
      user_id: user.id,
      text: text.trim(),
      parent_id: parentId ?? null,
      is_spoiler: Boolean(isSpoiler),
    })
    .select("id")
    .single();
  if (error || !comment) {
    console.error("postComment failed:", error);
    return;
  }

  const { data: chapter } = await supabase
    .from("chapters")
    .select("story:stories(id, author_id)")
    .eq("id", chapterId)
    .single();
  const story = chapter?.story as unknown as { id: string; author_id: string } | null;

  let parentAuthorId: string | null = null;
  if (parentId) {
    const { data: parent } = await supabase.from("comments").select("user_id").eq("id", parentId).single();
    parentAuthorId = parent?.user_id ?? null;
    if (parentAuthorId && parentAuthorId !== user.id) {
      await createNotification({
        userId: parentAuthorId,
        actorId: user.id,
        type: "comment_reply",
        storyId: story?.id,
        chapterId,
        commentId: comment.id,
      });
    }
  }

  if (story && story.author_id !== user.id && story.author_id !== parentAuthorId) {
    await createNotification({
      userId: story.author_id,
      actorId: user.id,
      type: "new_comment",
      storyId: story.id,
      chapterId,
      commentId: comment.id,
    });
  }

  revalidatePath(path);
}

export async function toggleCommentLike(commentId: string, path: string) {
  const { supabase, user } = await requireUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("target_type", "comment")
    .eq("target_id", commentId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("likes").delete().eq("id", existing.id);
    if (error) console.error("toggleCommentLike failed:", error);
    revalidatePath(path);
    return;
  }

  const { error } = await supabase
    .from("likes")
    .insert({ user_id: user.id, target_type: "comment", target_id: commentId });
  if (error) {
    console.error("toggleCommentLike failed:", error);
    revalidatePath(path);
    return;
  }

  const { data: comment } = await supabase
    .from("comments")
    .select("user_id, chapter_id, chapter:chapters(story_id)")
    .eq("id", commentId)
    .single();
  const chapter = comment?.chapter as unknown as { story_id: string } | null;
  if (comment && comment.user_id !== user.id) {
    await createNotification({
      userId: comment.user_id,
      actorId: user.id,
      type: "comment_like",
      storyId: chapter?.story_id,
      chapterId: comment.chapter_id,
      commentId,
    });
  }

  revalidatePath(path);
}
