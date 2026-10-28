"use server";

import { isTelegramPlaceholderEmail } from "@/lib/telegram-account";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { setCredentialPassword } from "@/server/auth/set-password";
import { loadViewer } from "@/server/data/viewer";
import { canEditOwnProfile } from "@/server/authz/policy";
import { uploadUrlPrefix } from "@/server/storage/local";
import { USERNAME_COOLDOWN_MS, isUsernameTaken, validateUsername } from "@/server/data/username";
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

const MAX_DISPLAY_NAME = 60;
const MAX_BIO = 1000;
const MAX_HANDLE = 60;

// Why the save was refused, so the form can tell the user which field to fix
// instead of a single generic error. `cooldownDays` is how many whole days
// are still left before the username may change again.
export type UpdateProfileResult =
  | { ok: true; username: string }
  | { ok: false; error: "generic" }
  | { ok: false; error: "username_format" | "username_reserved" | "username_taken" }
  | { ok: false; error: "username_cooldown"; cooldownDays: number };

// Returns ok:true (with the saved username) only when the profile was
// actually saved, so the form knows whether it is safe to clean up the
// previous avatar file — before, an empty name made this return silently
// while the form still deleted the old avatar, leaving the profile pointing
// at a missing file. `currentUsername` is the handle the page was opened
// under, used for revalidation.
export async function updateProfile(currentUsername: string, formData: FormData): Promise<UpdateProfileResult> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect(ROUTES.onboarding);

  const db = getDb();
  // A blocked account can't rename itself or change its avatar to dodge a
  // block (policy.ts canEditOwnProfile requires an active account).
  const viewer = await loadViewer(db, session.user.id);
  if (!viewer || !canEditOwnProfile(viewer, session.user.id)) return { ok: false, error: "generic" };

  const displayName = String(formData.get("displayName") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const avatarUrl = formData.get("avatarUrl");
  const instagramHandle = normalizeHandle(String(formData.get("instagramHandle") ?? ""));
  const telegramHandle = normalizeHandle(String(formData.get("telegramHandle") ?? ""));
  if (!displayName || displayName.length > MAX_DISPLAY_NAME || bio.length > MAX_BIO) return { ok: false, error: "generic" };
  if ((instagramHandle?.length ?? 0) > MAX_HANDLE || (telegramHandle?.length ?? 0) > MAX_HANDLE) return { ok: false, error: "generic" };

  // Username: optional field. The current @handle is read from the row (not
  // trusted from the page), so the once-a-week limit and the "unchanged?"
  // check can't be fooled by a stale or edited prop.
  const [row] = await db
    .select({ username: profiles.username, changedAt: profiles.username_changed_at })
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .limit(1);
  if (!row) return { ok: false, error: "generic" };

  let nextUsername: string | null = null;
  const rawUsername = formData.get("username");
  if (typeof rawUsername === "string" && rawUsername.trim() !== row.username) {
    const valid = validateUsername(rawUsername);
    if (!valid.ok) return { ok: false, error: valid.error === "reserved" ? "username_reserved" : "username_format" };
    // A case-only change (Ali → ali) is still a real change — but skip the
    // weekly limit and the taken check when the handle is effectively the
    // same word the user already owns.
    if (valid.value.toLowerCase() !== row.username.toLowerCase()) {
      if (row.changedAt) {
        const elapsed = Date.now() - row.changedAt.getTime();
        if (elapsed < USERNAME_COOLDOWN_MS) {
          const cooldownDays = Math.ceil((USERNAME_COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000));
          return { ok: false, error: "username_cooldown", cooldownDays };
        }
      }
      if (await isUsernameTaken(valid.value, session.user.id)) return { ok: false, error: "username_taken" };
    }
    nextUsername = valid.value;
  }

  // Only an avatar this user uploaded themselves (src/lib/actions/uploads.ts)
  // is accepted — not an arbitrary URL, which could point at a tracking
  // server or at someone else's file.
  const ownAvatar =
    typeof avatarUrl === "string" &&
    avatarUrl.startsWith(uploadUrlPrefix("avatars", session.user.id)) &&
    !avatarUrl.includes("..")
      ? avatarUrl
      : null;

  try {
    await db
      .update(profiles)
      .set({
        display_name: displayName,
        bio: bio || null,
        instagram_handle: instagramHandle,
        telegram_handle: telegramHandle,
        ...(ownAvatar ? { avatar_url: ownAvatar } : {}),
        ...(nextUsername ? { username: nextUsername, username_changed_at: new Date() } : {}),
      })
      .where(eq(profiles.id, session.user.id));
  } catch (err) {
    // Two people claiming the same handle at the same moment: the unique
    // index (profiles_username_key, Postgres code 23505) catches whoever
    // loses the race even though isUsernameTaken had just passed.
    if (nextUsername && (err as { code?: string })?.code === "23505") return { ok: false, error: "username_taken" };
    throw err;
  }

  const savedUsername = nextUsername ?? row.username;
  revalidatePath(ROUTES.author(currentUsername));
  if (savedUsername !== currentUsername) revalidatePath(ROUTES.author(savedUsername));
  return { ok: true, username: savedUsername };
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
  // Same minimum the forms enforce (MIN_PASSWORD_LENGTH = 6), now also on
  // the server; 128 caps the bcrypt input.
  if (typeof password !== "string" || password.length < 6 || password.length > 128) return { ok: false };

  // A Telegram-only account has no email to sign in with a password yet.
  if (isTelegramPlaceholderEmail(session.user.email)) return { ok: false };

  const db = getDb();
  // Only for an account that has no password yet. Changing an existing one
  // goes through the emailed-code reset instead — otherwise anyone holding a
  // stolen session could replace the owner's password without knowing it.
  const [profile] = await db
    .select({ has_password: profiles.has_password })
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .limit(1);
  if (!profile || profile.has_password) return { ok: false };

  await db.transaction(async (tx) => {
    await setCredentialPassword(tx, session.user.id, password);
    await tx.update(profiles).set({ has_password: true }).where(eq(profiles.id, session.user.id));
  });

  // Once a password exists, any other signed-in device is worth
  // re-verifying rather than trusting silently — sign out everywhere else,
  // keep this session (same reasoning src/app/auth/reset-password already
  // used for the same moment under Supabase).
  // The password is already saved — a failure here must not report the
  // whole action as failed (the user would retry and be refused).
  try {
    await getAuth().api.revokeOtherSessions({ headers: await headers() });
  } catch (err) {
    console.error("[profile] revokeOtherSessions failed", session.user.id, err);
  }

  return { ok: true };
}
