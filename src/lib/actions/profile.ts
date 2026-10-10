"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { getAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { setCredentialPassword } from "@/server/auth/set-password";
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

// Sets a password for an already-signed-in account that doesn't have one
// yet (Google/email-OTP only so far) — src/app/auth/set-password's whole
// reason to exist. Replaces what used to be three separate client-side
// calls (supabase.auth.updateUser, a markPasswordSet() action, supabase.
// auth.signOut({scope:"others"})) with one: this session is the proof of
// identity, same reasoning as onboarding's completeOnboarding.
export async function setInitialPassword(password: string): Promise<{ ok: boolean }> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return { ok: false };

  const db = getDb();
  await setCredentialPassword(db, session.user.id, password);
  await db.update(profiles).set({ has_password: true }).where(eq(profiles.id, session.user.id));

  // Once a password exists, any other signed-in device is worth
  // re-verifying rather than trusting silently — sign out everywhere else,
  // keep this session (same reasoning src/app/auth/reset-password already
  // used for the same moment under Supabase).
  await getAuth().api.revokeOtherSessions({ headers: await headers() });

  return { ok: true };
}
