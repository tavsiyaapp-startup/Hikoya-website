import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getAllCollectionsAdmin } from "@/lib/queries/admin";
import { AdminHeader } from "../AdminHeader";
import { Badge } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";
import { CollectionActions } from "./CollectionActions";

export default async function AdminCollectionsPage() {
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const collections = await getAllCollectionsAdmin();

  return (
    <div>
      <AdminHeader title={t.admin.collections} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <div className="mb-5.5 flex justify-end">
          <Link href={`${ROUTES.admin}/collections/new`}>
            <Button size="sm">{t.library.createCollection}</Button>
          </Link>
        </div>

        <div className="rounded-[22px] border border-border bg-card p-4.5 sm:p-6.5">
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="mb-3 flex items-center gap-4 border-b border-border-soft pb-3 text-[12px] font-bold uppercase tracking-wide text-muted-2">
                <span className="flex-[1.4]">{t.admin.colTitle}</span>
                <span className="w-40">{t.admin.colOwnerType}</span>
                <span className="w-27.5">{t.admin.colDate}</span>
                <span className="w-42.5 text-right">{t.admin.colAction}</span>
              </div>

              {collections.length > 0 ? (
                collections.map((c) => {
                  const owner = c.owner as unknown as { display_name: string } | null;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-4 border-b border-border-soft py-3.5 last:border-0"
                    >
                      <span className="flex-[1.4] truncate text-[13.5px] font-semibold text-ink-soft">
                        {c.title}
                      </span>
                      <span className="w-40">
                        <Badge tone={c.owner_type === "moderator" ? "pink" : "neutral"}>
                          {c.owner_type === "moderator" ? t.collections.editorial : owner?.display_name}
                        </Badge>
                      </span>
                      <span className="w-27.5 text-[13px] text-muted-2">
                        {new Date(c.created_at).toLocaleDateString(locale)}
                      </span>
                      <span className="w-42.5">
                        <CollectionActions collectionId={c.id} />
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-[13.5px] text-muted">{t.admin.emptyGeneric}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
