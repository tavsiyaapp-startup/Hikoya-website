"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, isLocale, defaultLocale } from "@/lib/i18n";

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
  const password = String(formData.get("password") ?? "");

  const cookieStore = await cookies();
  const role = cookieStore.get("hikoya_pending_role")?.value === "author" ? "author" : "reader";

  await supabase
    .from("profiles")
    .update({
      role,
      interests,
      locale_pref: locale,
      onboarded_at: new Date().toISOString(),
      ...(displayName ? { display_name: displayName } : {}),
    })
    .eq("id", user.id);

  // Best-effort: the name/interests/language above already saved, so a rare
  // password-set failure (e.g. Supabase rejecting it as too weak/reused)
  // shouldn't block finishing onboarding — the user can still set one later
  // from their profile.
  if (password) {
    await supabase.auth.updateUser({ password });
  }

  cookieStore.delete("hikoya_pending_role");
  cookieStore.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000 });

  redirect(next);
}
