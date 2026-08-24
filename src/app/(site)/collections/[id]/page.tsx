import { notFound } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCollectionWithStories } from "@/lib/queries/stories";
import { StoryCard } from "@/components/story/StoryCard";
import { Badge } from "@/components/ui/Chip";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  const result = await getCollectionWithStories(id);
  if (!result) notFound();
  const { collection, stories } = result;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {collection.owner_type === "moderator" && <Badge tone="pink">{t.collections.editorial}</Badge>}
        {collection.is_private && <Badge tone="neutral">{t.collections.private}</Badge>}
      </div>
      <h1 className="mb-2 text-[26px] font-extrabold tracking-tight sm:text-[32px]">{collection.title}</h1>
      {collection.description && (
        <p className="mb-7 max-w-155 text-[15px] leading-relaxed text-muted">{collection.description}</p>
      )}

      {stories.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5.5 lg:grid-cols-4">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border-soft bg-surface px-6 py-14 text-center text-[14px] text-muted">
          {t.collections.emptyInCollection}
        </div>
      )}
    </div>
  );
}
