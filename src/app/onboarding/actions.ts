"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { setCredentialPassword } from "@/server/auth/set-password";
import { LOCALE_COOKIE, isLocale, defaultLocale } from "@/lib/i18n";

const MIN_PASSWORD_LENGTH = 6;

export async function completeOnboarding(formData: FormData) {
  const session = await getAuth().api.getSession({ headers: await headers() });

  const next = (formData.get("next") as string) || "/";
  if (!session) redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  const userId = session.user.id;

  const interests = formData.getAll("interests").map(String);
  const localeValue = String(formData.get("locale") ?? "");
  const locale = isLocale(localeValue) ? localeValue : defaultLocale;
  const displayName = String(formData.get("displayName") ?? "").trim();
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const cookieStore = await cookies();
  const role: "author" | "reader" = cookieStore.get("hikoya_pending_role")?.value === "author" ? "author" : "reader";

  // The client (OnboardingWizard) already blocks continuing past this step
  // without a valid password, but this is the real trust boundary — a
  // request that skips that restarts the wizard rather than finishing
  // onboarding without one. redirectAfterAuth would otherwise have to send
  // them to /auth/set-password on their very next visit anyway, since
  // has_password never gets set below without a confirmed password.
  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  }

  const db = getDb();
  await setCredentialPassword(db, userId, password);

  const profileFields = {
    role,
    interests,
    locale_pref: locale,
    onboarded_at: new Date(),
    has_password: true,
    ...(displayName ? { display_name: displayName } : {}),
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    ...(bio ? { bio } : {}),
  };

  // This was previously a fire-and-forget update with no error handling —
  // if it silently failed, the password above had already been set, but
  // onboarded_at/has_password never got flipped in profiles. Every
  // subsequent visit would then bounce the user straight back to
  // onboarding via redirectAfterAuth, a real loop for real users. One
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
    } catch {
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
