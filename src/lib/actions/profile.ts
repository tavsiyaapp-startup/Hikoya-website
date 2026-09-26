"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/constants";

// Accepts a bare handle ("name"), a "@name", or a pasted full profile URL
// for either service, and reduces it to just the handle — the author page
// builds the actual link itself, so nothing here should end up storing a
// full URL.
function normalizeHandle(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withoutUrl = trimmed.replace(/^https?:\/\/(www\.)?(instagram\.com|t\.me)\//i, "");
  const handle = withoutUrl.replace(/^@/, "").split(/[/?#]/)[0].trim();
  return handle || null;
}

export async function updateProfile(username: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.onboarding);

  const displayName = String(formData.get("displayName") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const avatarUrl = formData.get("avatarUrl");
  const instagramHandle = normalizeHandle(String(formData.get("instagramHandle") ?? ""));
  const telegramHandle = normalizeHandle(String(formData.get("telegramHandle") ?? ""));
  if (!displayName) return;

  await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      bio: bio || null,
      instagram_handle: instagramHandle,
      telegram_handle: telegramHandle,
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
