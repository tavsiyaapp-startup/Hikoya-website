import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { getFeedForTab } from "@/lib/queries/stories";
import { StoryCard } from "@/components/story/StoryCard";
import { ExpandableStoryGrid } from "@/components/story/ExpandableStoryGrid";
import { Pagination } from "@/components/ui/Pagination";
import { LinkChip } from "@/components/ui/LinkChip";
import { LockIcon } from "@/components/ui/icons";
import { ROUTES } from "@/lib/constants";
import { HOME_TABS, type HomeTab } from "@/lib/homeTabs";

const PAGE_SIZE = 24; // 3 rows of 8 on desktop; mobile shows 12 with a "show more" reveal

function toPage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export default async function AllStoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { tab: rawTab, page: rawPage } = await searchParams;
  const tab: HomeTab = HOME_TABS.includes(rawTab as HomeTab) ? (rawTab as HomeTab) : "new";
  const page = toPage(rawPage);

  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const user = await getCurrentUser();

  const { items: stories, total } = await getFeedForTab(tab, user?.id, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(overrides: { tab?: HomeTab; page?: number }) {
    const params = new URLSearchParams();
    params.set("tab", overrides.tab ?? tab);
    const p = overrides.page ?? page;
    if (p > 1) params.set("page", String(p));
    return `?${params.toString()}`;
  }

  return (
    <div>
      <h1 className="mb-5 text-2xl font-extrabold tracking-tight">{t.home.tabs[tab]}</h1>

      <div className="mb-6 flex items-center gap-2.5 overflow-x-auto">
        {HOME_TABS.map((key) => {
          const locked = !user && (key === "forYou" || key === "following");
          return (
            <LinkChip
              key={key}
              href={locked ? ROUTES.onboarding : buildHref({ tab: key, page: 1 })}
              active={tab === key}
              shrink
            >
              <span>{t.home.tabs[key]}</span>
              {locked && <LockIcon />}
            </LinkChip>
          );
        })}
      </div>

      {stories.length > 0 ? (
        <>
          <ExpandableStoryGrid showMoreLabel={t.common.showMore}>
            {stories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </ExpandableStoryGrid>
          <Pagination page={page} totalPages={totalPages} buildHref={(p) => buildHref({ page: p })} />
        </>
      ) : (
        <div className="rounded-[12px] border border-dashed border-border-soft bg-surface px-6 py-10 text-center text-[14px] text-muted">
          {t.home.emptyFeed}
        </div>
      )}
    </div>
  );
}
