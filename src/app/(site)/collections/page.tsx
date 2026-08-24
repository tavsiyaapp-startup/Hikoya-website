import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { getPublicCollections } from "@/lib/queries/stories";
import { ROUTES } from "@/lib/constants";
import { Chip, Badge } from "@/components/ui/Chip";
import { createCollection } from "@/lib/actions/collections";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; create?: string }>;
}) {
  const { tab: rawTab, create } = await searchParams;

  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const user = await getCurrentUser();

  const TABS = [
    ["all", undefined, t.common.all],
    ["moderator", "moderator", t.collections.tabEditorial],
    ["user", "user", t.collections.tabReaders],
  ] as const;
  const activeTab = TABS.find(([key]) => key === rawTab) ?? TABS[0];
  const collections = await getPublicCollections(activeTab[1]);

  return (
    <div>
      <h1 className="mb-2 text-[32px] font-extrabold tracking-tight">{t.collections.title}</h1>
      <p className="mb-6.5 max-w-155 text-[15px] leading-relaxed text-muted">{t.collections.body}</p>

      <div className="mb-7 flex items-center gap-2.5">
        {TABS.map(([key, , label]) => (
          <Link key={key} href={`?tab=${key}`}>
            <Chip active={activeTab[0] === key}>{label}</Chip>
          </Link>
        ))}
        {user && (
          <Link href="?create=1" className="ml-auto">
            <Button size="sm">{t.library.createCollection}</Button>
          </Link>
        )}
      </div>

      {create && user && (
        <form action={createCollection} className="mb-7 rounded-3xl border border-border bg-card p-6.5">
          <Input name="title" placeholder={t.collections.createTitlePlaceholder} required className="mb-3.5" />
          <Textarea name="description" placeholder={t.collections.createDescPlaceholder} rows={2} className="mb-3.5" />
          <label className="mb-4 flex items-center gap-2 text-[13.5px] text-ink-soft">
            <input type="checkbox" name="isPrivate" className="h-4 w-4" />
            {t.collections.private}
          </label>
          <Button type="submit">{t.common.save}</Button>
        </form>
      )}

      {collections.length > 0 ? (
        <div className="grid grid-cols-3 gap-5.5">
          {collections.map((col) => (
            <Link
              key={col.id}
              href={ROUTES.collection(col.id)}
              className="rounded-[22px] border border-border bg-card p-5 hover:border-primary-300 hover:shadow-[0_14px_30px_rgba(60,40,120,0.1)]"
            >
              <div className="mb-2 flex items-center gap-2">
                {col.owner_type === "moderator" && <Badge tone="pink">{t.collections.editorial}</Badge>}
                {col.is_private && <Badge tone="neutral">{t.collections.private}</Badge>}
              </div>
              <h3 className="mb-1.5 text-[17px] font-extrabold">{col.title}</h3>
              <p className="line-clamp-2 text-[13.5px] leading-relaxed text-muted">{col.description}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border-soft bg-surface px-6 py-14 text-center text-[14px] text-muted">
          {t.collections.noneYet}
        </div>
      )}
    </div>
  );
}
