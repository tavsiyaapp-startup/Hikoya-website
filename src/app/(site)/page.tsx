import { Suspense } from "react";
import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import type { CurrentUser } from "@/lib/current-user";
import { ROUTES } from "@/lib/constants";
import {
  getFeedForTab,
  getFeaturedCollections,
  getRecentPublishedChapters,
  getHeroSlides,
  getAnnouncements,
  // getTopStories, // TODO: re-enable along with the "Топ" section below
} from "@/lib/queries/stories";
import { StoryCard } from "@/components/story/StoryCard";
import { StoryCarousel } from "@/components/story/StoryCarousel";
import { CollectionCard } from "@/components/collections/CollectionCard";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { AnnouncementBoard } from "@/components/home/AnnouncementBoard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Chip";
import { Pagination } from "@/components/ui/Pagination";
import { SparkleIcon, LockIcon } from "@/components/ui/icons";
import { HOME_TABS, type HomeTab } from "@/lib/homeTabs";
// import type { StoryTopTier } from "@/types/database";

// const TOP_TIERS: StoryTopTier[] = ["day", "week", "month"];

// Per-section page sizes on the home page — beyond these, pagination kicks
// in (each section keeps its own page number in the URL, independent of
// the others). The feed tabs aren't paginated — each is its own
// StoryCarousel, so this is just how many items get pulled into each row.
const PAGE_SIZE_FEED = 24;
const PAGE_SIZE_WEEK = 24; // also a carousel now, not paginated — see PAGE_SIZE_FEED
const PAGE_SIZE_COLLECTIONS = 6;

function toPage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export default async function HomePage({
  searchParams,
}: {
  // "Топ" section temporarily commented out — see below. Re-add topTier?: string
  // here when it comes back.
  searchParams: Promise<{
    collectionsPage?: string;
  }>;
}) {
  const { collectionsPage: rawCollectionsPage } = await searchParams;
  // const topTier: StoryTopTier = TOP_TIERS.includes(rawTopTier as StoryTopTier)
  //   ? (rawTopTier as StoryTopTier)
  //   : "day";

  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const user = await getCurrentUser();

  const collectionsPage = toPage(rawCollectionsPage);

  // Hero + announcements are both small, 60s-cached queries — fetched and
  // awaited directly (not behind Suspense) so this region — the page's LCP
  // element — renders as part of the static shell instead of waiting on the
  // heavier queries below, which is what used to gate every byte of this
  // page behind one shared Promise.all.
  const [heroSlides, announcements] = await Promise.all([getHeroSlides(), getAnnouncements(2)]);

  return (
    <div>
      {/* flex-[3] vs. AnnouncementBoard's flex-1 (in AnnouncementBoard.tsx) —
          a 3:1 ratio, so the board takes ~25% of the row on any screen
          rather than a fixed pixel width that'd look disproportionate at
          very narrow or very wide viewports. */}
      <div className="mb-9.5 flex flex-col gap-4 sm:flex-row">
        <div className="sm:min-w-0 sm:flex-[3]">
          <HeroCarousel slides={heroSlides} />
        </div>
        <AnnouncementBoard announcements={announcements} />
      </div>

      <Suspense fallback={<HomeSectionsSkeleton />}>
        <HomeSections user={user} t={t} collectionsPage={collectionsPage} />
      </Suspense>
    </div>
  );
}

async function HomeSections({
  user,
  t,
  collectionsPage,
}: {
  user: CurrentUser | null;
  t: Dictionary;
  collectionsPage: number;
}) {
  // forYou/following need a real account to mean anything — getFeedForTab
  // falls back to the popular feed for them without one, which would just
  // render "Популярное" twice for a guest. Only fetch/show the two tabs that
  // are genuinely public.
  const feedTabs: readonly HomeTab[] = user ? HOME_TABS : HOME_TABS.filter((k) => k === "popular" || k === "new");

  const [feedResults, weeklyResult, collectionsResult] = await Promise.all([
    Promise.all(feedTabs.map((key) => getFeedForTab(key, user?.id, PAGE_SIZE_FEED, 0))),
    getRecentPublishedChapters(PAGE_SIZE_WEEK, 0),
    getFeaturedCollections(PAGE_SIZE_COLLECTIONS, (collectionsPage - 1) * PAGE_SIZE_COLLECTIONS),
    // getTopStories(topTier, 8),
  ]);

  const weeklyGroups = weeklyResult.items;
  const collections = collectionsResult.items;

  const collectionsTotalPages = Math.max(1, Math.ceil(collectionsResult.total / PAGE_SIZE_COLLECTIONS));

  // Every home-page pagination link goes through this so paginating the
  // collections section preserves its own current page instead of resetting
  // it.
  function buildHref(overrides: Partial<Record<"collectionsPage", number>>) {
    const params = new URLSearchParams();
    const pages = { collectionsPage, ...overrides };
    for (const [key, value] of Object.entries(pages)) {
      if (value > 1) params.set(key, String(value));
    }
    return `?${params.toString()}`;
  }

  return (
    <>
      {/* "Топ" section — commented out for now, re-enable later (see also the
          commented-out topTier/getTopStories bits above).
      <div className="mb-4.5 flex items-center gap-3.5">
        <h2 className="text-2xl font-extrabold tracking-tight">{t.home.topTitle}</h2>
        <div className="ml-auto flex gap-1.5">
          {TOP_TIERS.map((tier) => (
            <Link
              key={tier}
              href={`?tab=${tab}&genre=${encodeURIComponent(genre)}&topTier=${tier}`}
              scroll={false}
            >
              <Chip active={topTier === tier}>{t.home.topTiers[tier]}</Chip>
            </Link>
          ))}
        </div>
      </div>
      {topStories.length > 0 ? (
        <div className="mb-11 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5.5 lg:grid-cols-4">
          {topStories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      ) : (
        <EmptyRow className="mb-11" />
      )}
      */}

      {feedTabs.map((key, i) => {
        const items = feedResults[i].items;
        return (
          <div key={key}>
            <div className="mb-4.5 flex items-baseline gap-3.5">
              <h2 className="text-2xl font-extrabold tracking-tight">{t.home.tabs[key]}</h2>
              <Link href={ROUTES.allStories(key)} className="ml-auto text-[14px] font-semibold">
                {t.common.all}
              </Link>
            </div>
            {items.length > 0 ? (
              <div className="mb-11">
                <StoryCarousel>
                  {items.map((story) => (
                    <StoryCard key={story.id} story={story} />
                  ))}
                </StoryCarousel>
              </div>
            ) : (
              <EmptyRow className="mb-11" />
            )}
          </div>
        );
      })}

      <div className="mb-4.5 flex items-baseline gap-3.5">
        <h2 className="text-2xl font-extrabold tracking-tight">{t.home.weekTitle}</h2>
        <Link href={ROUTES.search} className="ml-auto text-[14px] font-semibold">
          {t.common.all}
        </Link>
      </div>
      {weeklyGroups.length > 0 ? (
        <div className="mb-11">
          <StoryCarousel>
            {weeklyGroups.map((group) => (
              <StoryCard
                key={group.story.id}
                story={group.story}
                href={
                  group.singleChapter
                    ? ROUTES.chapter(group.story.slug, group.singleChapter.order_index)
                    : ROUTES.story(group.story.slug)
                }
                ribbonLabel={t.home.weekChaptersAddedN.replace("{n}", String(group.chapterCount))}
              />
            ))}
          </StoryCarousel>
        </div>
      ) : (
        <EmptyRow className="mb-11" />
      )}

      <div className="mb-4.5 flex items-center gap-3.5">
        <h2 className="text-2xl font-extrabold tracking-tight">{t.home.editorialTitle}</h2>
        <Badge tone="pink">
          <SparkleIcon />
          <span>{t.home.editorialBadge}</span>
        </Badge>
        <Link href={ROUTES.collections} className="ml-auto text-[14px] font-semibold">
          {t.common.all}
        </Link>
      </div>
      {collections.length > 0 ? (
        <div className="mb-11">
          <div className="grid grid-cols-1 gap-4.5 xs:grid-cols-2 sm:grid-cols-3 sm:gap-5.5">
            {collections.map((col) => (
              <CollectionCard key={col.id} collection={col} />
            ))}
          </div>
          <Pagination
            page={collectionsPage}
            totalPages={collectionsTotalPages}
            buildHref={(p) => buildHref({ collectionsPage: p })}
          />
        </div>
      ) : (
        <EmptyRow className="mb-11" />
      )}

      {!user && (
        <div className="mt-11 flex flex-col items-start gap-4 rounded-[16px] bg-linear-to-br from-ink-dark to-primary-950 px-5 py-6 text-white sm:flex-row sm:items-center sm:gap-6 sm:px-8 sm:py-6.5">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-[12px] bg-white/12">
            <LockIcon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="mb-1 text-[18px] font-extrabold">{t.home.gateTitle}</div>
            <div className="text-[14px] leading-relaxed text-primary-200">{t.home.gateBody}</div>
          </div>
          <Link href={ROUTES.onboarding} className="w-full shrink-0 sm:w-auto">
            <Button
              className="w-full justify-center border-none shadow-none sm:w-auto"
              style={{ background: "#fff", color: "#4C1D95" }}
            >
              {t.home.gateCta}
            </Button>
          </Link>
        </div>
      )}
    </>
  );
}

async function EmptyRow({ className = "" }: { className?: string }) {
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  return (
    <div
      className={`rounded-[12px] border border-dashed border-border-soft bg-surface px-6 py-10 text-center text-[14px] text-muted ${className}`}
    >
      {t.home.emptyFeed}
    </div>
  );
}

// Matches the stacked-carousels' approximate shape so replacing it with real
// content doesn't visibly jump (CLS).
function HomeSectionsSkeleton() {
  return (
    <div className="animate-pulse">
      {[0, 1].map((row) => (
        <div key={row} className="mb-11">
          <div className="mb-4.5 h-8 w-40 rounded-lg bg-surface" />
          <div className="flex gap-4 overflow-hidden sm:gap-5.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] w-[118px] shrink-0 rounded-[14px] bg-surface xs:w-[138px] sm:w-[158px] lg:w-[172px]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
