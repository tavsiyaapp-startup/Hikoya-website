import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { getCurrentUser } from "@/lib/current-user";
import { isTelegramPlaceholderEmail } from "@/lib/telegram-account";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
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
      needsPassword={!isTelegramPlaceholderEmail(user?.email)}
      error={error === "save" || error === "auth" ? error : null}
    />
  );
}
