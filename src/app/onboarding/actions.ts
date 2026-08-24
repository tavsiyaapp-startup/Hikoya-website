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

  const cookieStore = await cookies();
  const role = cookieStore.get("hikoya_pending_role")?.value === "author" ? "author" : "reader";

  await supabase
    .from("profiles")
    .update({
      role,
      interests,
      locale_pref: locale,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  cookieStore.delete("hikoya_pending_role");
  cookieStore.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000 });

  redirect(next);
}
