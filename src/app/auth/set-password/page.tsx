import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { ROUTES } from "@/lib/constants";
import { SetPasswordForm } from "./SetPasswordForm";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "/" } = await searchParams;
  const user = await getCurrentUser();

  if (!user) redirect(`${ROUTES.login}?next=${encodeURIComponent(next)}`);
  if (!user.profile?.onboarded_at) {
    redirect(`${ROUTES.onboarding}?next=${encodeURIComponent(next)}`);
  }
  if (user.profile.has_password) redirect(next);

  return <SetPasswordForm next={next} email={user.email ?? ""} />;
}
