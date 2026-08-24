"use server";

import { revalidatePath } from "next/cache";
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

  revalidatePath(ROUTES.collections);
  revalidatePath(ROUTES.library);
}

async function isAuthor(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return data?.role === "author";
}
