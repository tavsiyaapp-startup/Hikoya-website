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
  getFeaturedCollections,
  getRecentPublishedChapters,
  getContinueReading,
} from "@/lib/queries/stories";
import { StoryCard } from "@/components/story/StoryCard";
import { Button } from "@/components/ui/Button";
import { Badge, Chip } from "@/components/ui/Chip";
import { SparkleIcon, LockIcon } from "@/components/ui/icons";

const TABS = ["forYou", "popular", "new", "following"] as const;
type Tab = (typeof TABS)[number];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; genre?: string }>;
}) {
  const { tab: rawTab, genre: rawGenre } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "forYou";

  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const user = await getCurrentUser();
  const genre = rawGenre ?? t.genres[0];

  const [feed, weekly, collections, genreStories, continueReading] = await Promise.all([
    tab === "new" ? getNewestStories(8) : getPopularStories(8),
    getRecentPublishedChapters(3),
    getFeaturedCollections(3),
    getStoriesByGenre(genre, 4),
    user ? getContinueReading(user.id, 3) : Promise.resolve([]),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center gap-2.5 overflow-x-auto">
        {TABS.map((key) => {
          const locked = !user && (key === "forYou" || key === "following");
          return (
            <Link
              key={key}
              href={locked ? ROUTES.onboarding : `?tab=${key}`}
              className="inline-flex shrink-0"
            >
              <Chip active={tab === key}>
                <span>{t.home.tabs[key]}</span>
                {locked && <LockIcon />}
              </Chip>
            </Link>
          );
        })}
        {!user && (
          <div className="ml-auto hidden shrink-0 items-center gap-2 rounded-xl bg-primary-50 px-3.5 py-2 text-[12.5px] font-semibold text-[#5B4B8A] sm:flex">
            <span>{t.home.guestHint}</span>
          </div>
        )}
      </div>

      <section className="mb-9.5 flex flex-col overflow-hidden rounded-[26px] border border-primary-100 bg-linear-to-br from-primary-50 via-[#F6ECFB] to-pink-bg sm:flex-row">
        <div className="flex-1 p-6 sm:p-11">
          <div className="mb-4.5 inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3.5 py-1.5 text-[12px] font-bold text-primary-800">
            <SparkleIcon className="text-primary-700" />
            <span>{t.home.heroKicker}</span>
          </div>
          <h1 className="mb-3 max-w-[480px] text-[28px] font-extrabold leading-tight tracking-tight text-balance sm:text-[40px]">
            {t.home.heroTitle}
          </h1>
          <p className="mb-6.5 max-w-[430px] text-[14.5px] leading-relaxed text-ink-soft sm:text-[15.5px]">
            {t.home.heroBody}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={user ? ROUTES.create : ROUTES.onboarding}>
              <Button size="lg">{t.home.heroCta}</Button>
            </Link>
            <Link href={ROUTES.search}>
              <Button size="lg" variant="secondary" className="bg-white/70">
                {t.home.heroCta2}
              </Button>
            </Link>
          </div>
        </div>
        <div className="relative h-48 w-full sm:h-auto sm:min-h-75 sm:w-[46%]">
          <Image
            src="/images/banner-write.jpg"
            alt=""
            fill
            className="object-cover object-right"
          />
          <div className="absolute inset-0 bg-linear-to-r from-primary-50 to-transparent sm:block hidden" />
        </div>
      </section>

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

      <div className="mb-4.5 flex items-baseline gap-3.5">
        <h2 className="text-2xl font-extrabold tracking-tight">{t.home.feedTitle}</h2>
        <Link href={ROUTES.search} className="ml-auto text-[14px] font-semibold">
          {t.common.all}
        </Link>
      </div>
      {feed.length > 0 ? (
        <div className="mb-11 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5.5 lg:grid-cols-4">
          {feed.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
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
        <div className="mb-11 grid grid-cols-1 gap-4.5 xs:grid-cols-2 sm:grid-cols-3">
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
        <div className="mb-11 grid grid-cols-1 gap-4.5 xs:grid-cols-2 sm:grid-cols-3 sm:gap-5.5">
          {collections.map((col) => (
            <Link
              key={col.id}
              href={ROUTES.collection(col.id)}
              className="rounded-[22px] border border-border bg-card p-5 hover:border-primary-300 hover:shadow-[0_14px_30px_rgba(60,40,120,0.1)]"
            >
              <h3 className="mb-1.5 text-[17px] font-extrabold">{col.title}</h3>
              <p className="text-[13.5px] leading-relaxed text-muted">{col.description}</p>
            </Link>
          ))}
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
            <Link key={g} href={`?tab=${tab}&genre=${encodeURIComponent(g)}`}>
              <Chip active={g === genre}>{g}</Chip>
            </Link>
          ))}
        </div>
        {genreStories.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5.5 lg:grid-cols-4">
            {genreStories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
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
