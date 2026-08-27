import Link from "next/link";
import Image from "next/image";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { ROUTES } from "@/lib/constants";
import {
  getPopularStories,
  getNewestStories,
  getStoriesByGenre,
  getFollowingStories,
  getForYouStories,
  getFeaturedCollections,
  getRecentPublishedChapters,
  getContinueReading,
  getHeroSlides,
  // getTopStories, // TODO: re-enable along with the "Топ" section below
} from "@/lib/queries/stories";
import { StoryCard } from "@/components/story/StoryCard";
import { CollectionCard } from "@/components/collections/CollectionCard";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Chip";
import { LinkChip } from "@/components/ui/LinkChip";
import { Pagination } from "@/components/ui/Pagination";
import { SparkleIcon, LockIcon } from "@/components/ui/icons";
// import type { StoryTopTier } from "@/types/database";

const TABS = ["forYou", "popular", "new", "following"] as const;
type Tab = (typeof TABS)[number];
// const TOP_TIERS: StoryTopTier[] = ["day", "week", "month"];

// Per-section page sizes on the home page — beyond these, pagination kicks
// in (each section keeps its own page number in the URL, independent of
// the others).
const PAGE_SIZE_FEED = 10;
const PAGE_SIZE_WEEK = 6;
const PAGE_SIZE_COLLECTIONS = 6;
const PAGE_SIZE_GENRE = 10;

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
    tab?: string;
    genre?: string;
    feedPage?: string;
    weekPage?: string;
    collectionsPage?: string;
    genrePage?: string;
  }>;
}) {
  const {
    tab: rawTab,
    genre: rawGenre,
    feedPage: rawFeedPage,
    weekPage: rawWeekPage,
    collectionsPage: rawCollectionsPage,
    genrePage: rawGenrePage,
  } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "forYou";
  // const topTier: StoryTopTier = TOP_TIERS.includes(rawTopTier as StoryTopTier)
  //   ? (rawTopTier as StoryTopTier)
  //   : "day";

  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const user = await getCurrentUser();
  const genre = rawGenre ?? t.genres[0];

  const feedPage = toPage(rawFeedPage);
  const weekPage = toPage(rawWeekPage);
  const collectionsPage = toPage(rawCollectionsPage);
  const genrePage = toPage(rawGenrePage);

  const feedOffset = (feedPage - 1) * PAGE_SIZE_FEED;
  const feedQuery =
    tab === "new"
      ? getNewestStories(PAGE_SIZE_FEED, feedOffset)
      : tab === "following" && user
        ? getFollowingStories(user.id, PAGE_SIZE_FEED, feedOffset)
        : tab === "forYou" && user
          ? getForYouStories(user.id, PAGE_SIZE_FEED, feedOffset)
          : getPopularStories(PAGE_SIZE_FEED, feedOffset);

  const [feedResult, weeklyResult, collectionsResult, genreResult, continueReading, heroSlides] = await Promise.all([
    feedQuery,
    getRecentPublishedChapters(PAGE_SIZE_WEEK, (weekPage - 1) * PAGE_SIZE_WEEK),
    getFeaturedCollections(PAGE_SIZE_COLLECTIONS, (collectionsPage - 1) * PAGE_SIZE_COLLECTIONS),
    getStoriesByGenre(genre, PAGE_SIZE_GENRE, (genrePage - 1) * PAGE_SIZE_GENRE),
    user ? getContinueReading(user.id, 3) : Promise.resolve([]),
    getHeroSlides(),
    // getTopStories(topTier, 8),
  ]);

  const feed = feedResult.items;
  const weekly = weeklyResult.items;
  const collections = collectionsResult.items;
  const genreStories = genreResult.items;

  const feedTotalPages = Math.max(1, Math.ceil(feedResult.total / PAGE_SIZE_FEED));
  const weekTotalPages = Math.max(1, Math.ceil(weeklyResult.total / PAGE_SIZE_WEEK));
  const collectionsTotalPages = Math.max(1, Math.ceil(collectionsResult.total / PAGE_SIZE_COLLECTIONS));
  const genreTotalPages = Math.max(1, Math.ceil(genreResult.total / PAGE_SIZE_GENRE));

  // Every home-page pagination link goes through this so paginating one
  // section preserves the tab/genre filter and the other three sections'
  // current pages, instead of resetting them.
  function buildHref(overrides: Partial<Record<"feedPage" | "weekPage" | "collectionsPage" | "genrePage", number>>) {
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("genre", genre);
    const pages = { feedPage, weekPage, collectionsPage, genrePage, ...overrides };
    for (const [key, value] of Object.entries(pages)) {
      if (value > 1) params.set(key, String(value));
    }
    return `?${params.toString()}`;
  }

  return (
    <div>
      <HeroCarousel slides={heroSlides} />

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

      {user && continueReading.length > 0 && (
        <>
          <h2 className="mb-4.5 text-2xl font-extrabold tracking-tight">
            {t.home.continueReading}
          </h2>
          <div className="mb-11 grid grid-cols-1 gap-4.5 xs:grid-cols-2 sm:grid-cols-3">
            {continueReading.map((item, i) => {
              const story = item.story as unknown as {
                id: string;
                title: string;
                slug: string;
                cover_url: string | null;
              } | null;
              if (!story) return null;
              return (
                <Link
                  key={i}
                  href={ROUTES.story(story.slug)}
                  className="flex gap-3.5 rounded-2xl border border-border bg-card p-3.5 hover:border-primary-300"
                >
                  <div className="relative h-21 w-21 shrink-0 overflow-hidden rounded-[13px] bg-primary-200">
                    {story.cover_url && (
                      <Image src={story.cover_url} alt="" fill className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-1.5 line-clamp-2 text-[15px] font-bold leading-tight">
                      {story.title}
                    </h3>
                    <div className="h-2 w-full max-w-30 overflow-hidden rounded-full bg-border-soft">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-primary-700 to-primary-500"
                        style={{ width: `${Math.min(100, Math.round(item.percent))}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <div className="mb-6 flex items-center gap-2.5 overflow-x-auto">
        {TABS.map((key) => {
          const locked = !user && (key === "forYou" || key === "following");
          return (
            <LinkChip key={key} href={locked ? ROUTES.onboarding : `?tab=${key}`} active={tab === key} shrink>
              <span>{t.home.tabs[key]}</span>
              {locked && <LockIcon />}
            </LinkChip>
          );
        })}
        {!user && (
          <div className="ml-auto hidden shrink-0 items-center gap-2 rounded-xl bg-primary-50 px-3.5 py-2 text-[12.5px] font-semibold text-[#5B4B8A] dark:text-[#C4B8E8] sm:flex">
            <span>{t.home.guestHint}</span>
          </div>
        )}
      </div>

      <div className="mb-4.5 flex items-baseline gap-3.5">
        <h2 className="text-2xl font-extrabold tracking-tight">{t.home.feedTitle}</h2>
        <Link href={ROUTES.search} className="ml-auto text-[14px] font-semibold">
          {t.common.all}
        </Link>
      </div>
      {feed.length > 0 ? (
        <div className="mb-11">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5.5 lg:grid-cols-4">
            {feed.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
          <Pagination page={feedPage} totalPages={feedTotalPages} buildHref={(p) => buildHref({ feedPage: p })} />
        </div>
      ) : (
        <EmptyRow className="mb-11" />
      )}

      <div className="mb-4.5 flex items-baseline gap-3.5">
        <h2 className="text-2xl font-extrabold tracking-tight">{t.home.weekTitle}</h2>
        <Link href={ROUTES.search} className="ml-auto text-[14px] font-semibold">
          {t.common.all}
        </Link>
      </div>
      {weekly.length > 0 ? (
        <div className="mb-11">
          <div className="grid grid-cols-1 gap-4.5 xs:grid-cols-2 sm:grid-cols-3">
            {weekly.map((row) => {
              const story = row.story as unknown as { title: string; slug: string; cover_url: string | null } | null;
              if (!story) return null;
              return (
                <Link
                  key={row.id}
                  href={ROUTES.chapter(story.slug, row.order_index)}
                  className="flex gap-3.5 rounded-[18px] border border-border bg-card p-3.5 hover:border-primary-300 hover:shadow-[0_10px_24px_rgba(60,40,120,0.09)]"
                >
                  <div className="relative h-21 w-21 shrink-0 overflow-hidden rounded-[14px] bg-primary-200">
                    {story.cover_url && (
                      <Image src={story.cover_url} alt="" fill className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Badge tone="primary" className="mb-1.5">{story.title}</Badge>
                    <h3 className="mb-1 line-clamp-2 text-[15px] font-bold leading-tight">
                      {row.title}
                    </h3>
                  </div>
                </Link>
              );
            })}
          </div>
          <Pagination page={weekPage} totalPages={weekTotalPages} buildHref={(p) => buildHref({ weekPage: p })} />
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

      <div className="rounded-3xl border border-border bg-card px-4 py-6 sm:px-7 sm:py-6.5">
        <div className="mb-4.5 flex items-center gap-3.5">
          <h2 className="text-[22px] font-extrabold tracking-tight">{t.home.genreTitle}</h2>
        </div>
        <div className="mb-6 flex flex-wrap gap-2">
          {t.genres.map((g) => (
            <LinkChip key={g} href={`?tab=${tab}&genre=${encodeURIComponent(g)}`} scroll={false} active={g === genre}>
              {g}
            </LinkChip>
          ))}
        </div>
        {genreStories.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5.5 lg:grid-cols-4">
              {genreStories.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
            <Pagination page={genrePage} totalPages={genreTotalPages} buildHref={(p) => buildHref({ genrePage: p })} />
          </>
        ) : (
          <EmptyRow />
        )}
      </div>

      {!user && (
        <div className="mt-11 flex flex-col items-start gap-4 rounded-3xl bg-linear-to-br from-ink-dark to-primary-950 px-5 py-6 text-white sm:flex-row sm:items-center sm:gap-6 sm:px-8 sm:py-6.5">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-white/12">
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
    </div>
  );
}

async function EmptyRow({ className = "" }: { className?: string }) {
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  return (
    <div
      className={`rounded-2xl border border-dashed border-border-soft bg-surface px-6 py-10 text-center text-[14px] text-muted ${className}`}
    >
      {t.home.emptyFeed}
    </div>
  );
}
