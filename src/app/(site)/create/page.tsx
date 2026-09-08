import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getAllTags, getCustomLanguages } from "@/lib/queries/stories";
import { ROUTES } from "@/lib/constants";
import { CreateWizard } from "./CreateWizard";

export default async function CreatePage() {
  const user = await getCurrentUser();
  if (!user) redirect(`${ROUTES.onboarding}?next=${encodeURIComponent(ROUTES.create)}`);

  const [existingTags, existingLanguages] = await Promise.all([getAllTags(), getCustomLanguages()]);

  return <CreateWizard userId={user.id} existingTags={existingTags} existingLanguages={existingLanguages} />;
}
