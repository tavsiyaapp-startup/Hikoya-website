import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { AdminHeader } from "../../AdminHeader";
import { CollectionForm } from "../CollectionForm";
import { createCollectionAdmin } from "@/lib/actions/admin";

export default async function AdminNewCollectionPage() {
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  return (
    <div>
      <AdminHeader title={t.library.createCollection} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <CollectionForm action={createCollectionAdmin} />
      </div>
    </div>
  );
}
