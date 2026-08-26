import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { ROUTES } from "@/lib/constants";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "/" } = await searchParams;
  const user = await getCurrentUser();

  if (user) {
    redirect(user.profile?.onboarded_at ? next : `${ROUTES.onboarding}?next=${encodeURIComponent(next)}`);
  }

  return <LoginForm next={next} />;
}
