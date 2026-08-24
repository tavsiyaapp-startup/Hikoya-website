"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/constants";

export async function updateProfile(username: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const displayName = String(formData.get("displayName") ?? "").trim();
  const avatarUrl = formData.get("avatarUrl");
  if (!displayName) return;

  await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      ...(typeof avatarUrl === "string" && avatarUrl ? { avatar_url: avatarUrl } : {}),
    })
    .eq("id", user.id);

  revalidatePath(ROUTES.author(username));
}
