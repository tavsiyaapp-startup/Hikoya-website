import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { getCurrentUser } from "@/lib/current-user";
import { ROUTES } from "@/lib/constants";
import { isTelegramPlaceholderEmail } from "@/lib/telegram-account";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const { next: rawNext, mode } = await searchParams;
  const next = safeNext(rawNext);
  const user = await getCurrentUser();

  if (user) {
    if (!user.profile?.onboarded_at) {
      redirect(`${ROUTES.onboarding}?next=${encodeURIComponent(next)}`);
    }
    // A Telegram-only account has nothing to pair a password with yet.
    if (!user.profile.has_password && !isTelegramPlaceholderEmail(user.email)) {
      redirect(`${ROUTES.setPassword}?next=${encodeURIComponent(next)}`);
    }
    redirect(next);
  }

  return <LoginForm next={next} initialFallback={mode === "fallback"} />;
}
