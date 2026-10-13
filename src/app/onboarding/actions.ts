"use server";

import { cookies, headers } from "next/headers";
import { safeNext } from "@/lib/safe-next";
import { uploadUrlPrefix } from "@/server/storage/local";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { isTelegramPlaceholderEmail } from "@/lib/telegram-account";
import { setCredentialPassword } from "@/server/auth/set-password";
import { LOCALE_COOKIE, isLocale, defaultLocale } from "@/lib/i18n";

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const MAX_DISPLAY_NAME = 60;
const MAX_BIO = 1000;
const MAX_INTERESTS = 20;
const MAX_INTEREST_LENGTH = 40;

export async function completeOnboarding(formData: FormData) {
  const session = await getAuth().api.getSession({ headers: await headers() });

  const next = safeNext(formData.get("next") as string | null);
  if (!session) redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  const userId = session.user.id;

  const db = getDb();
  // Onboarding runs once. Replaying this action for an account that already
  // finished it must not set a new password (which needs the old one, via
  // the emailed-code reset) or overwrite the role from the pending-role cookie
  // — a moderator or admin replaying it would otherwise demote themselves,
  // and anyone holding a stolen session could take the account over.
  const [current] = await db
    .select({ onboarded_at: profiles.onboarded_at, email: profiles.email })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  if (!current || current.onboarded_at) redirect(next);

  const interests = formData
    .getAll("interests")
    .map(String)
    .filter((i) => i.length > 0 && i.length <= MAX_INTEREST_LENGTH)
    .slice(0, MAX_INTERESTS);
  const localeValue = String(formData.get("locale") ?? "");
  const locale = isLocale(localeValue) ? localeValue : defaultLocale;
  const displayName = String(formData.get("displayName") ?? "").trim();
  const rawAvatarUrl = String(formData.get("avatarUrl") ?? "").trim();
  // Only an avatar this user uploaded (src/lib/actions/uploads.ts) — never an
  // arbitrary URL from the form. Anything else (e.g. the Google photo the
  // wizard was pre-filled with) just leaves the existing avatar_url as is.
  const avatarUrl =
    rawAvatarUrl.startsWith(uploadUrlPrefix("avatars", userId)) && !rawAvatarUrl.includes("..") ? rawAvatarUrl : "";
  const bio = String(formData.get("bio") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const cookieStore = await cookies();
  const role: "author" | "reader" = cookieStore.get("hikoya_pending_role")?.value === "author" ? "author" : "reader";

  // The client (OnboardingWizard) already blocks continuing past this step
  // without a valid password, but this is the real trust boundary — a
  // request that skips that restarts the wizard rather than finishing
  // onboarding without one. /login's post-sign-in routing would otherwise have to send
  // them to /auth/set-password on their very next visit anyway, since
  // has_password never gets set below without a confirmed password.
  // A Telegram-only account has no email to pair a password with — it skips
  // the password until an email is linked (then /login asks for one).
  const telegramOnly = isTelegramPlaceholderEmail(current.email);
  if (
    (!telegramOnly && (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH)) ||
    displayName.length > MAX_DISPLAY_NAME ||
    bio.length > MAX_BIO
  ) {
    redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  }

  if (!telegramOnly) await setCredentialPassword(db, userId, password);

  const profileFields = {
    role,
    interests,
    locale_pref: locale,
    onboarded_at: new Date(),
    has_password: !telegramOnly,
    ...(displayName ? { display_name: displayName } : {}),
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    ...(bio ? { bio } : {}),
  };

  // This was previously a fire-and-forget update with no error handling —
  // if it silently failed, the password above had already been set, but
  // onboarded_at/has_password never got flipped in profiles. Every
  // subsequent visit would then bounce the user straight back to
  // onboarding via /login's post-sign-in routing, a real loop for real users. One
  // retry covers a transient blip; a second failure is logged so it's
  // visible in server logs, and this redirects with a real error flag
  // instead of pretending it worked.
  async function applyProfileUpdate(): Promise<boolean> {
    try {
      const [row] = await db
        .update(profiles)
        .set(profileFields)
        .where(eq(profiles.id, userId))
        .returning({ id: profiles.id });
      return Boolean(row);
    } catch (err) {
      console.error("completeOnboarding: profiles update failed", userId, err);
      return false;
    }
  }

  let ok = await applyProfileUpdate();
  if (!ok) ok = await applyProfileUpdate();
  if (!ok) {
    console.error(`completeOnboarding: profiles update failed to persist for user ${userId} after retry`);
    redirect(`/onboarding?next=${encodeURIComponent(next)}&error=save`);
  }

  cookieStore.delete("hikoya_pending_role");
  cookieStore.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000 });

  redirect(next);
}
