"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, isLocale, defaultLocale } from "@/lib/i18n";

const MIN_PASSWORD_LENGTH = 6;

export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const next = (formData.get("next") as string) || "/";
  if (!user) redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  const userId = user.id;

  const interests = formData.getAll("interests").map(String);
  const localeValue = formData.get("locale");
  const locale = isLocale(localeValue as string) ? (localeValue as string) : defaultLocale;
  const displayName = String(formData.get("displayName") ?? "").trim();
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const cookieStore = await cookies();
  const role = cookieStore.get("hikoya_pending_role")?.value === "author" ? "author" : "reader";

  // The client (OnboardingWizard) already blocks continuing past this step
  // without a valid password, but this is the real trust boundary — a
  // request that skips that (or a password Supabase itself rejects, e.g. a
  // leaked-password check) restarts the wizard rather than finishing
  // onboarding without one. redirectAfterAuth would otherwise have to send
  // them to /auth/set-password on their very next visit anyway, since
  // has_password never gets set below without a confirmed password.
  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  }
  const { error: passwordError } = await supabase.auth.updateUser({ password });
  if (passwordError) {
    redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  }

  const profileFields = {
    role,
    interests,
    locale_pref: locale,
    onboarded_at: new Date().toISOString(),
    has_password: true,
    ...(displayName ? { display_name: displayName } : {}),
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    ...(bio ? { bio } : {}),
  };

  // This was previously a fire-and-forget update with no error handling —
  // if it silently failed (or RLS silently matched 0 rows, which Postgrest
  // reports as a normal empty result, not an error), the password above
  // had already been set in Supabase Auth, but onboarded_at/has_password
  // never got flipped in profiles. Every subsequent visit would then bounce
  // the user straight back to onboarding via redirectAfterAuth, which reset
  // the wizard to step 3 and asked for a password again — a real loop for
  // real users, found via profiles with has_password=false long after
  // their created_at. .select().single() (not just checking `error`) is
  // what actually catches the RLS-silent-no-op case; a plain error check
  // alone would have missed it. One retry covers a transient blip; a
  // second failure is logged so it's visible in server logs, and this
  // redirects with a real error flag instead of pretending it worked.
  async function applyProfileUpdate() {
    const { data, error } = await supabase
      .from("profiles")
      .update(profileFields)
      .eq("id", userId)
      .select("id")
      .single();
    return { ok: !error && Boolean(data) };
  }

  let { ok } = await applyProfileUpdate();
  if (!ok) {
    ({ ok } = await applyProfileUpdate());
  }
  if (!ok) {
    console.error(`completeOnboarding: profiles update failed to persist for user ${userId} after retry`);
    redirect(`/onboarding?next=${encodeURIComponent(next)}&error=save`);
  }

  cookieStore.delete("hikoya_pending_role");
  cookieStore.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000 });

  redirect(next);
}
