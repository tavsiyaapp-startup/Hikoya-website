import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "/" } = await searchParams;
  const user = await getCurrentUser();

  if (user?.profile?.onboarded_at) {
    redirect(next);
  }

  return (
    <OnboardingWizard
      initialStep={user ? 3 : 1}
      next={next}
      userId={user?.id ?? null}
      initialDisplayName={user?.profile?.display_name ?? ""}
      initialAvatarUrl={user?.profile?.avatar_url ?? null}
      initialBio={user?.profile?.bio ?? ""}
    />
  );
}
