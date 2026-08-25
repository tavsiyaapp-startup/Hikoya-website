"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/constants";

export async function createRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const title = String(formData.get("title") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const targetAuthorId = String(formData.get("targetAuthorId") ?? "") || null;
  if (!title || !text) return;

  await supabase.from("requests").insert({
    from_user_id: user.id,
    target_author_id: targetAuthorId,
    title,
    text,
  });

  revalidatePath(ROUTES.board);
}

export async function respondToRequest(requestId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;

  const rawStoryId = String(formData.get("storyId") ?? "").trim();
  let storyId: string | null = null;
  if (rawStoryId) {
    const { data: story } = await supabase
      .from("stories")
      .select("id")
      .eq("id", rawStoryId)
      .eq("author_id", user.id)
      .maybeSingle();
    storyId = story?.id ?? null;
  }

  await supabase
    .from("request_responses")
    .insert({ request_id: requestId, author_id: user.id, text, story_id: storyId });
  await supabase.from("requests").update({ status: "in_progress" }).eq("id", requestId).eq("status", "open");

  revalidatePath(ROUTES.board);
}

// Only the requester who opened it can close their own request (staff use
// the separate admin action, which also allows reopening/deleting).
export async function closeRequest(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  await supabase
    .from("requests")
    .update({ status: "closed" })
    .eq("id", requestId)
    .eq("from_user_id", user.id)
    .neq("status", "closed");

  revalidatePath(ROUTES.board);
}
