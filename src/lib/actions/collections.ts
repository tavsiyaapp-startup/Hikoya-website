"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/constants";

export async function createCollection(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const isPrivate = formData.get("isPrivate") === "on";
  if (!title) return;

  const ownerType = user.id && (await isAuthor(user.id)) ? "author" : "user";

  await supabase.from("collections").insert({
    owner_id: user.id,
    owner_type: ownerType,
    title,
    description: description || null,
    is_private: isPrivate,
  });

  updateTag("collections");
  revalidatePath(ROUTES.collections);
  revalidatePath(ROUTES.library);
}

async function isAuthor(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return data?.role === "author";
}

// The "+ Создать подборку" row inside the story card's collection picker —
// creating a collection there means you obviously want *this* story in it,
// so it's added in the same round trip instead of dropping the user on
// /collections with the story they started from now nowhere in sight.
export async function createCollectionWithStory(
  storyId: string,
  title: string,
  path: string
): Promise<{ id: string; title: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const trimmed = title.trim();
  if (!trimmed) return { error: "empty_title" };

  const ownerType = (await isAuthor(user.id)) ? "author" : "user";

  const { data: collection, error } = await supabase
    .from("collections")
    .insert({ owner_id: user.id, owner_type: ownerType, title: trimmed })
    .select("id, title")
    .single();
  if (error || !collection) return { error: "failed" };

  await supabase.from("collection_items").insert({ collection_id: collection.id, story_id: storyId });

  updateTag("collections");
  revalidatePath(path);
  revalidatePath(ROUTES.collections);
  revalidatePath(ROUTES.library);

  return { id: collection.id, title: collection.title };
}

export async function updateCollection(collectionId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const isPrivate = formData.get("isPrivate") === "on";
  if (!title) return;

  await supabase
    .from("collections")
    .update({ title, description: description || null, is_private: isPrivate })
    .eq("id", collectionId)
    .eq("owner_id", user.id);

  updateTag("collections");
  revalidatePath(ROUTES.collection(collectionId));
  revalidatePath(ROUTES.collections);
  revalidatePath(ROUTES.library);
}

export async function toggleSavedCollection(collectionId: string, path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const { data: existing } = await supabase
    .from("saved_collections")
    .select("collection_id")
    .eq("user_id", user.id)
    .eq("collection_id", collectionId)
    .maybeSingle();

  if (existing) {
    await supabase.from("saved_collections").delete().eq("user_id", user.id).eq("collection_id", collectionId);
  } else {
    await supabase.from("saved_collections").insert({ user_id: user.id, collection_id: collectionId });
  }

  revalidatePath(path);
  revalidatePath(ROUTES.collections);
}

// RLS on collection_items already restricts writes to the collection's own
// owner, so a foreign collectionId just silently affects 0 rows here.
export async function toggleStoryInCollection(collectionId: string, storyId: string, path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const { data: existing } = await supabase
    .from("collection_items")
    .select("story_id")
    .eq("collection_id", collectionId)
    .eq("story_id", storyId)
    .maybeSingle();

  if (existing) {
    await supabase.from("collection_items").delete().eq("collection_id", collectionId).eq("story_id", storyId);
  } else {
    await supabase.from("collection_items").insert({ collection_id: collectionId, story_id: storyId });
  }

  updateTag("collections");
  revalidatePath(path);
  revalidatePath(ROUTES.library);
}
