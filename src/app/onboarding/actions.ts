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

  await supabase
    .from("profiles")
    .update({
      role,
      interests,
      locale_pref: locale,
      onboarded_at: new Date().toISOString(),
      has_password: true,
      ...(displayName ? { display_name: displayName } : {}),
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      ...(bio ? { bio } : {}),
    })
    .eq("id", user.id);

  cookieStore.delete("hikoya_pending_role");
  cookieStore.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000 });

  redirect(next);
}
