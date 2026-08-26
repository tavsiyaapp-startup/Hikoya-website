import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { getPublicCollections, getMyCollections, getSavedCollections } from "@/lib/queries/stories";
import { ROUTES } from "@/lib/constants";
import { LinkChip } from "@/components/ui/LinkChip";
import { CollectionCard } from "@/components/collections/CollectionCard";
import { createCollection } from "@/lib/actions/collections";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

const TABS = ["moderator", "users", "mine", "saved"] as const;
type Tab = (typeof TABS)[number];

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; create?: string }>;
}) {
  const { tab: rawTab, create } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "moderator";

  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const user = await getCurrentUser();

  const [publicCollections, myCollections, savedCollections] = await Promise.all([
    tab === "moderator" || tab === "users"
      ? getPublicCollections(tab === "moderator" ? "moderator" : ["author", "user"])
      : Promise.resolve([]),
    tab === "mine" && user ? getMyCollections(user.id) : Promise.resolve([]),
    tab === "saved" && user ? getSavedCollections(user.id) : Promise.resolve([]),
  ]);

  const collections = tab === "mine" ? myCollections : tab === "saved" ? savedCollections : publicCollections;
  const emptyText =
    tab === "mine" ? t.collections.noneYetMine : tab === "saved" ? t.collections.noneYetSaved : t.collections.noneYet;
  const needsLogin = (tab === "mine" || tab === "saved") && !user;

  return (
    <div>
      <h1 className="mb-2 text-[26px] font-extrabold tracking-tight sm:text-[32px]">{t.collections.title}</h1>
      <p className="mb-6.5 max-w-155 text-[15px] leading-relaxed text-muted">{t.collections.body}</p>

      <div className="mb-7 flex items-center gap-2.5 overflow-x-auto">
        {(
          [
            ["moderator", t.collections.tabEditorial],
            ["users", t.collections.tabUsers],
            ["mine", t.collections.tabMine],
            ["saved", t.collections.tabSaved],
          ] as const
        ).map(([key, label]) => (
          <LinkChip key={key} href={`?tab=${key}`} active={tab === key} shrink>
            {label}
          </LinkChip>
        ))}
        {user && (
          <Link href="?create=1" className="ml-auto shrink-0">
            <Button size="sm">{t.library.createCollection}</Button>
          </Link>
        )}
      </div>

      {create && user && (
        <form action={createCollection} className="mb-7 rounded-3xl border border-border bg-card p-4.5 sm:p-6.5">
          <Input name="title" placeholder={t.collections.createTitlePlaceholder} required className="mb-3.5" />
          <Textarea name="description" placeholder={t.collections.createDescPlaceholder} rows={2} className="mb-3.5" />
          <label className="mb-4 flex items-center gap-2 text-[13.5px] text-ink-soft">
            <input type="checkbox" name="isPrivate" className="h-4 w-4" />
            {t.collections.private}
          </label>
          <Button type="submit">{t.common.save}</Button>
        </form>
      )}

      {needsLogin ? (
        <div className="rounded-2xl border border-dashed border-border-soft bg-surface px-6 py-14 text-center text-[14px] text-muted">
          <p className="mb-4">{tab === "mine" ? t.collections.loginToManage : t.collections.loginToSave}</p>
          <Link href={ROUTES.onboarding} className="inline-block">
            <Button size="sm">{t.common.login}</Button>
          </Link>
        </div>
      ) : collections.length > 0 ? (
        <div className="grid grid-cols-1 gap-4.5 xs:grid-cols-2 sm:grid-cols-3 sm:gap-5.5">
          {collections.map((col) => (
            <CollectionCard key={col.id} collection={col} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border-soft bg-surface px-6 py-14 text-center text-[14px] text-muted">
          {emptyText}
        </div>
      )}
    </div>
  );
}
