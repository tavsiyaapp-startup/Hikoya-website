import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { ROUTES } from "@/lib/constants";
import { CreateWizard } from "./CreateWizard";

export default async function CreatePage() {
  const user = await getCurrentUser();
  if (!user) redirect(`${ROUTES.onboarding}?next=${encodeURIComponent(ROUTES.create)}`);

  return <CreateWizard userId={user.id} />;
}
