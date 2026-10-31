import Link from "next/link";
import Image from "next/image";
import { GeneratedCover, coverPalette } from "@/components/story/GeneratedCover";
import { notFound } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { getStoryBySlug, getChaptersForStory, getMyCollectionsWithStory } from "@/lib/queries/stories";
import {
  getUserStoryState,
  isFollowingAuthor,
  getFollowerCount,
  getReadChapterIds,
} from "@/lib/queries/social";
import { getDb } from "@/server/db/client";
import { getSorovPostIdForStory } from "@/server/data/forum";
import { formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/constants";
import { RELATIONSHIP_TYPES } from "@/lib/relationshipTypes";
import { localizeGenre } from "@/lib/genre";
import { languageLabel } from "@/lib/language";
import { storyProgressTone, storyProgressLabel } from "@/lib/storyProgress";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { LikeBookmarkRow, FollowButton, ReadingStatusSelect } from "@/components/story/StoryActions";
import { ImageZoom } from "@/components/story/ImageZoom";
import { StoryTabs } from "@/components/story/StoryTabs";
import { LockIcon } from "@/components/ui/icons";
import type { ReadingStatus } from "@/types/database";
import { liveImageUrl } from "@/lib/images";
import { plural } from "@/lib/plural";
import { getFreeChaptersForStory, getMySubscriptionExpiry, getPaywallState } from "@/lib/queries/paywall";

function relationshipLabel(value: string, locale: "ru" | "uz"): string {
  if (locale === "ru") return value;
  return RELATIONSHIP_TYPES.find(([ru]) => ru === value)?.[1] ?? value;
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const user = await getCurrentUser();

  const story = await getStoryBySlug(slug);
  if (!story) notFound();

  // «Obuna»: chapters past the free ones get a lock for readers who would
  // hit the subscription popup there.
  const paywall = await getPaywallState();
  let lockedFrom: number | null = null;
  if (paywall.live) {
    const role = user?.profile?.role;
    const exempt = user?.id === story.author.id || role === "admin" || role === "moderator";
    const [free, expiry] = await Promise.all([getFreeChaptersForStory(story.id, paywall), getMySubscriptionExpiry(user?.id)]);
    if (!exempt && !(expiry && expiry > new Date())) lockedFrom = free + 1;
  }

  const [chapters, social, following, followerCount, linkedRequestId, myCollections, readChapterIds] =
    await Promise.all([
      getChaptersForStory(story.id),
      getUserStoryState(user?.id, story.id),
      isFollowingAuthor(user?.id, story.author.id),
      getFollowerCount(story.author.id),
      // getDb() inside the promise: if it throws, .catch still gets it.
    Promise.resolve().then(() => getSorovPostIdForStory(getDb(), story.id)).catch(() => null),
      user ? getMyCollectionsWithStory(user.id, story.id) : Promise.resolve([]),
      getReadChapterIds(user?.id, story.id),
    ]);

  const canManage = user?.id === story.author.id;
  const path = ROUTES.story(slug);
  const firstChapter = chapters[0];
  const continueChapter = social.continueChapterId
    ? chapters.find((c) => c.id === social.continueChapterId)
    : undefined;
  const readCta = continueChapter ?? firstChapter;
  const metrics = [
    { label: t.common.views, value: story.view_count },
    { label: t.common.like, value: story.like_count },
    { label: t.common.comments, value: story.comment_count },
    { label: t.story.chapters, value: chapters.length },
  ];

  const cover = liveImageUrl(story.cover_url);
  const palette = coverPalette(story.id);

  return (
    <div className="relative">
      {/* Backdrop behind the top of the page: the cover itself, blurred and
          fading out — or the colours of the drawn cover. z-0 (not negative):
          a negative z-index would drop it behind the page background. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[-1rem] -top-4 z-0 h-[420px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_45%,transparent)] sm:inset-x-[-1.5rem] lg:inset-x-[-2.25rem]"
      >
        {cover ? (
          <Image src={cover} alt="" fill sizes="240px" className="scale-125 object-cover opacity-45 blur-3xl" />
        ) : (
          <div
            className="absolute inset-0 opacity-35"
            style={{ background: `radial-gradient(60% 90% at 20% 0%, ${palette.glow}, transparent 70%), linear-gradient(120deg, ${palette.to}66, transparent 70%)` }}
          />
        )}
      </div>

    <div className="relative z-[1] flex flex-col items-start gap-6 lg:flex-row lg:gap-9">
      <div className="w-full lg:sticky lg:top-26 lg:w-75 lg:shrink-0">
        {liveImageUrl(story.cover_url) ? (
          <ImageZoom
            src={liveImageUrl(story.cover_url)!}
            alt={story.title}
            triggerClassName="relative mx-auto mb-4.5 block aspect-[3/4] w-full max-w-60 cursor-zoom-in overflow-hidden rounded-[14px] bg-primary-200 shadow-[0_18px_40px_rgba(60,40,120,0.18)] sm:max-w-70 lg:mx-0 lg:max-w-none"
          >
            <Image src={liveImageUrl(story.cover_url)!} alt="" fill className="object-cover" />
          </ImageZoom>
        ) : (
          <div className="relative mx-auto mb-4.5 aspect-[3/4] w-full max-w-60 overflow-hidden rounded-[14px] shadow-[0_24px_50px_-18px_rgba(45,31,85,0.55)] sm:max-w-70 lg:mx-0 lg:max-w-none">
            <GeneratedCover seed={story.id} title={story.title} author={story.author?.display_name} />
          </div>
        )}

        <div className="lg:hidden">
          <h1 className="mb-2 text-[24px] font-extrabold leading-tight tracking-tight text-balance sm:text-[28px]">
            {story.title}
          </h1>
          <p className="mb-5 whitespace-pre-line border-l-2 border-primary-300 pl-4 font-display text-[16px] leading-relaxed text-ink-soft">
            {story.description}
          </p>
        </div>

        {readCta ? (
          <Link prefetch={false} href={ROUTES.chapter(slug, readCta.order_index)}>
            <Button size="lg" className="mb-2.5 w-full justify-center">
              {continueChapter ? t.story.continueReading : t.story.read}
            </Button>
          </Link>
        ) : (
          <div className="mb-2.5 flex h-13.5 w-full items-center justify-center rounded-[12px] border border-dashed border-border-soft text-[13px] text-muted">
            {t.story.noChaptersYet}
          </div>
        )}

        <LikeBookmarkRow
          storyId={story.id}
          isAuthenticated={Boolean(user)}
          initialLiked={social.liked}
          initialBookmarked={social.bookmarked}
          collections={myCollections}
          path={path}
          title={story.title}
        />

        {user && (
          <ReadingStatusSelect
            storyId={story.id}
            initialStatus={social.readingStatus as ReadingStatus | null}
            path={path}
          />
        )}

        <div className="rounded-[12px] border border-border bg-card p-4.5">
          <Link prefetch={false} href={ROUTES.author(story.author.username)} className="mb-3.5 flex items-center gap-2.5">
            <Avatar name={story.author.display_name} src={story.author.avatar_url} />
            <div className="min-w-0">
              <div className="text-[14.5px] font-bold">{story.author.display_name}</div>
              <div className="text-[12.5px] text-muted-2">
                {followerCount} {plural(followerCount, t.author.subscribers)}
              </div>
            </div>
          </Link>
          <FollowButton
            authorId={story.author.id}
            isAuthenticated={Boolean(user)}
            initialFollowing={following}
            path={path}
          />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-3.5 flex flex-wrap items-center gap-2">
          {/* Each genre links to search pre-filtered by it. The localized
              label is passed as the value: it matches the genre chip shown on
              the search page, and the filter maps it across locales itself. */}
          {story.genres.map((g) => (
            <Link key={g} prefetch={false} href={`/search?genre=${encodeURIComponent(localizeGenre(g, locale))}`} className="transition hover:opacity-80">
              <Badge tone="pink">{localizeGenre(g, locale)}</Badge>
            </Link>
          ))}
          {story.relationship_type && (
            <Badge tone="primary">{relationshipLabel(story.relationship_type, locale)}</Badge>
          )}
          <Badge tone={story.age_rating === "18+" ? "danger" : "neutral"}>{story.age_rating}</Badge>
          <Badge tone={storyProgressTone(story.progress_status)}>{storyProgressLabel(t, story.progress_status)}</Badge>
          <Badge tone="neutral">{languageLabel(t, story.language)}</Badge>
          {story.is_translation && <Badge tone="neutral">{t.story.translationBadge}</Badge>}
          {linkedRequestId && (
            <Link prefetch={false} href={ROUTES.forumPost(linkedRequestId)}>
              <Badge tone="primary">{t.story.requestBadge}</Badge>
            </Link>
          )}
          {canManage && (
            <Link prefetch={false} href={ROUTES.manage(slug)} className="ml-auto">
              <Button variant="secondary" size="sm">
                {t.story.manageCta}
              </Button>
            </Link>
          )}
        </div>
        <h1 className="mb-5 hidden max-w-175 text-[28px] font-extrabold leading-tight tracking-tight text-balance lg:block lg:text-[44px]">
          {story.title}
        </h1>

        <div className="mb-7 flex flex-wrap gap-6 rounded-[18px] border border-border/80 bg-card/80 px-5 py-5 backdrop-blur-sm sm:gap-12 sm:px-7 sm:py-5.5">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="mb-0.5 font-display text-[26px] font-bold tabular-nums tracking-tight">{m.value}</div>
              <div className="text-[13px] text-muted-2">{m.label}</div>
            </div>
          ))}
        </div>

        <p className="mb-9 hidden max-w-[68ch] whitespace-pre-line border-l-2 border-primary-300 pl-5 font-display text-[18px] leading-[1.7] text-ink-soft lg:block">
          {story.description}
        </p>

        <StoryTabs
          storyId={story.id}
          slug={slug}
          path={path}
          isLoggedIn={Boolean(user)}
          isBlocked={user?.profile?.status === "blocked"}
          viewerId={user?.id ?? null}
          chaptersCount={chapters.length}
          initialCommentsCount={story.comment_count}
          chapters={
            <div className="overflow-hidden rounded-[18px] border border-border bg-card">
              {chapters.length > 0 ? (
                chapters.map((ch, i) => {
                  const isRead = readChapterIds.has(ch.id);
                  return (
                    <Link prefetch={false}
                      key={ch.id}
                      href={ROUTES.chapter(slug, ch.order_index)}
                      className={clsxRow(i, chapters.length)}
                    >
                      <span className="w-9 shrink-0 font-display text-[19px] font-semibold tabular-nums text-primary-400">
                        {String(ch.order_index).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className={`font-display text-[16.5px] font-semibold leading-snug ${isRead ? "text-muted-2" : "text-ink"}`}>{ch.title}</span>
                        <div className="mt-1 text-[12.5px] text-muted-3">
                          {formatDateTime(ch.published_at ?? ch.created_at, locale)} · {ch.comment_count ?? 0} {t.common.comments}
                        </div>
                      </div>
                      {isRead && (
                        <span
                          title={t.story.chapterRead}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-[11px] font-bold text-success"
                        >
                          ✓
                        </span>
                      )}
                      {lockedFrom !== null && ch.order_index >= lockedFrom ? (
                        <LockIcon className="h-4 w-4 shrink-0 text-muted-2" aria-label={t.paywall.badge} />
                      ) : (
                        ch.is_free && <Badge tone="primary">{t.common.read}</Badge>
                      )}
                    </Link>
                  );
                })
              ) : (
                <div className="px-6 py-10 text-center text-[14px] text-muted-2">
                  {t.story.noChaptersBody}
                </div>
              )}
            </div>
          }
        />

        {!user && (
          <div className="mt-7 flex flex-col items-start gap-4 rounded-[14px] border border-primary-100 bg-linear-to-br from-primary-50 to-pink-bg px-5 py-5 sm:flex-row sm:items-center sm:gap-5 sm:px-7 sm:py-6">
            <div className="flex-1">
              <div className="mb-1 text-[17px] font-extrabold">{t.story.authorCta}</div>
              <div className="text-[14px] leading-relaxed text-ink-soft">{t.story.authorCtaBody}</div>
            </div>
            <Link prefetch={false} href={ROUTES.onboarding} className="w-full shrink-0 sm:w-auto">
              <Button className="w-full justify-center sm:w-auto">{t.story.authorCtaButton}</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

function clsxRow(index: number, total: number) {
  const border = index < total - 1 ? "border-b border-border-soft" : "";
  return `group flex items-center gap-4 px-5.5 py-4.5 transition hover:bg-primary-50/60 ${border}`;
}
