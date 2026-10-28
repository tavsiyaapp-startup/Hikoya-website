import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getAllTags, getAllGenres, getCustomLanguages } from "@/lib/queries/stories";
import { ROUTES } from "@/lib/constants";
import { CreateWizard } from "./CreateWizard";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getMyPublishGate, getPaywallState, paywallOffer } from "@/lib/queries/paywall";
import { AuthorPublishNotice } from "@/components/paywall/AuthorPublishNotice";

export default async function CreatePage() {
  const user = await getCurrentUser();
  if (!user) redirect(`${ROUTES.onboarding}?next=${encodeURIComponent(ROUTES.create)}`);

  const [existingTags, existingGenres, existingLanguages, publishGate, paywall, locale] = await Promise.all([
    getAllTags(),
    getAllGenres(),
    getCustomLanguages(),
    getMyPublishGate(user.id),
    getPaywallState(),
    getServerLocale(),
  ]);

  return (
    <>
      {/* «Obuna»: a new story is kept as a draft while publishing needs a subscription. */}
      <div className="mx-auto max-w-3xl">
        <AuthorPublishNotice
          allowed={publishGate.allowed}
          freeLeft={publishGate.freeLeft}
          offer={paywallOffer(paywall.settings, locale)}
          nextPath={ROUTES.create}
        />
      </div>
      <CreateWizard userId={user.id} existingTags={existingTags} existingGenres={existingGenres} existingLanguages={existingLanguages} />
    </>
  );
}
