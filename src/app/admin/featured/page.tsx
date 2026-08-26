import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { searchStoriesForFeaturedAdmin, getFeaturedTiersMap } from "@/lib/queries/admin";
import { AdminHeader } from "../AdminHeader";
import { Input } from "@/components/ui/Input";
import { FeaturedStoryRow } from "./FeaturedStoryRow";
import type { StoryTopTier } from "@/types/database";

export default async function AdminFeaturedPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const stories = await searchStoriesForFeaturedAdmin(q);
  const tiersByStory = await getFeaturedTiersMap(stories.map((s) => s.id));

  return (
    <div>
      <AdminHeader title={t.admin.featured} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <div className="rounded-[22px] border border-border bg-card p-4.5 sm:p-6.5">
          <p className="mb-5 text-[13.5px] text-muted-2">{t.admin.featuredHint}</p>
          <form className="mb-5 max-w-105">
            <Input name="q" defaultValue={q} placeholder={t.admin.searchStories} />
          </form>

          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="mb-3 flex items-center gap-4 border-b border-border-soft pb-3 text-[12px] font-bold uppercase tracking-wide text-muted-2">
                <span className="flex-[1.6]">{t.admin.colStory}</span>
                <span className="w-27.5 shrink-0">{t.admin.topTierDay}</span>
                <span className="w-27.5 shrink-0">{t.admin.topTierWeek}</span>
                <span className="w-27.5 shrink-0">{t.admin.topTierMonth}</span>
              </div>

              {stories.length > 0 ? (
                stories.map((s) => {
                  const author = s.author as unknown as { display_name: string } | null;
                  return (
                    <FeaturedStoryRow
                      key={s.id}
                      storyId={s.id}
                      title={s.title}
                      authorName={author?.display_name}
                      tiers={tiersByStory.get(s.id) ?? new Set<StoryTopTier>()}
                    />
                  );
                })
              ) : (
                <div className="py-6 text-center text-[13.5px] text-muted">{t.admin.emptyGeneric}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
