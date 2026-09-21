import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { ROUTES } from "@/lib/constants";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const { next = "/", mode } = await searchParams;
  const user = await getCurrentUser();

  if (user) {
    if (!user.profile?.onboarded_at) {
      redirect(`${ROUTES.onboarding}?next=${encodeURIComponent(next)}`);
    }
    if (!user.profile.has_password) {
      redirect(`${ROUTES.setPassword}?next=${encodeURIComponent(next)}`);
    }
    redirect(next);
  }

  return <LoginForm next={next} initialFallback={mode === "fallback"} />;
}
