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
  const bio = String(formData.get("bio") ?? "").trim();
  const avatarUrl = formData.get("avatarUrl");
  if (!displayName) return;

  await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      bio: bio || null,
      ...(typeof avatarUrl === "string" && avatarUrl ? { avatar_url: avatarUrl } : {}),
    })
    .eq("id", user.id);

  revalidatePath(ROUTES.author(username));
}

// Called right after the client sets a password itself (supabase.auth.
// updateUser — /auth/set-password and /auth/reset-password both do this)
// to flip the tracking flag so redirectAfterAuth stops routing the user to
// /auth/set-password. See profiles.has_password in schema_reference.sql for
// why this can't be derived from the session/identities instead.
export async function markPasswordSet() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ has_password: true }).eq("id", user.id);
}
