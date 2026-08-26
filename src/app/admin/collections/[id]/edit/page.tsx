import { notFound } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCollectionByIdAdmin, getCollectionItemIds } from "@/lib/queries/admin";
import { AdminHeader } from "../../../AdminHeader";
import { CollectionForm } from "../../CollectionForm";
import { updateCollectionAdmin } from "@/lib/actions/admin";

export default async function AdminEditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  const [collection, itemIds] = await Promise.all([getCollectionByIdAdmin(id), getCollectionItemIds(id)]);
  if (!collection) notFound();

  return (
    <div>
      <AdminHeader title={t.admin.editCollection} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <CollectionForm
          action={updateCollectionAdmin.bind(null, id)}
          initialTitle={collection.title}
          initialDescription={collection.description ?? ""}
          initialFeatured={collection.is_featured}
          initialCheckedIds={itemIds}
        />
      </div>
    </div>
  );
}
