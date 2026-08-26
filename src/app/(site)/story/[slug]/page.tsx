import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { getStoryBySlug, getChaptersForStory, getMyCollectionsWithStory } from "@/lib/queries/stories";
import { getUserStoryState, isFollowingAuthor, getFollowerCount, getStoryComments } from "@/lib/queries/social";
import type { StoryCommentRow } from "@/lib/queries/social";
import type { Dictionary } from "@/lib/i18n";
import { getLinkedRequestForStory } from "@/lib/queries/requests";
import { ROUTES } from "@/lib/constants";
import { RELATIONSHIP_TYPES } from "@/lib/relationshipTypes";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Chip";
import { LinkChip } from "@/components/ui/LinkChip";
import { Button } from "@/components/ui/Button";
import { LikeBookmarkRow, FollowButton, ReadingStatusSelect } from "@/components/story/StoryActions";
import type { ReadingStatus } from "@/types/database";

function relationshipLabel(value: string, locale: "ru" | "uz"): string {
  if (locale === "ru") return value;
  return RELATIONSHIP_TYPES.find(([ru]) => ru === value)?.[1] ?? value;
}

const TABS = ["chapters", "comments"] as const;
type Tab = (typeof TABS)[number];

export default async function StoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "chapters";
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const user = await getCurrentUser();

  const story = await getStoryBySlug(slug);
  if (!story) notFound();

  const [chapters, social, following, followerCount, linkedRequestId, myCollections, storyComments] = await Promise.all([
    getChaptersForStory(story.id),
    getUserStoryState(user?.id, story.id),
    isFollowingAuthor(user?.id, story.author.id),
    getFollowerCount(story.author.id),
    getLinkedRequestForStory(story.id),
    user ? getMyCollectionsWithStory(user.id, story.id) : Promise.resolve([]),
    tab === "comments" ? getStoryComments(story.id) : Promise.resolve([]),
  ]);

  const canManage = user?.id === story.author.id;
  const path = ROUTES.story(slug);
  const firstChapter = chapters[0];
  const metrics = [
    { label: t.common.views, value: story.view_count },
    { label: t.common.like, value: story.like_count },
    { label: t.common.comments, value: story.comment_count },
    { label: t.story.chapters, value: chapters.length },
  ];

  return (
    <div className="flex flex-col items-start gap-6 lg:flex-row lg:gap-9">
      <div className="w-full lg:sticky lg:top-26 lg:w-75 lg:shrink-0">
        <div className="relative mx-auto mb-4.5 aspect-[3/4] w-full max-w-60 overflow-hidden rounded-[22px] bg-primary-200 shadow-[0_18px_40px_rgba(60,40,120,0.18)] sm:max-w-70 lg:mx-0 lg:max-w-none">
          {story.cover_url && <Image src={story.cover_url} alt={story.title} fill className="object-cover" />}
        </div>

        {firstChapter ? (
          <Link href={ROUTES.chapter(slug, firstChapter.order_index)}>
            <Button size="lg" className="mb-2.5 w-full justify-center">
              {t.story.read}
            </Button>
          </Link>
        ) : (
          <div className="mb-2.5 flex h-13.5 w-full items-center justify-center rounded-2xl border border-dashed border-border-soft text-[13px] text-muted">
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
        />

        {user && (
          <ReadingStatusSelect
            storyId={story.id}
            initialStatus={social.readingStatus as ReadingStatus | null}
            path={path}
          />
        )}

        <div className="rounded-[18px] border border-border bg-card p-4.5">
          <Link href={ROUTES.author(story.author.username)} className="mb-3.5 flex items-center gap-2.5">
            <Avatar name={story.author.display_name} src={story.author.avatar_url} />
            <div className="min-w-0">
              <div className="text-[14.5px] font-bold">{story.author.display_name}</div>
              <div className="text-[12.5px] text-muted-2">
                {followerCount} {t.author.subscribers}
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
          <Badge tone="pink">{story.genre}</Badge>
          {story.relationship_type && (
            <Badge tone="primary">{relationshipLabel(story.relationship_type, locale)}</Badge>
          )}
          <Badge tone={story.age_rating === "18+" ? "danger" : "neutral"}>{story.age_rating}</Badge>
          <Badge tone="success">{story.status === "published" ? t.common.ongoing : t.common.finished}</Badge>
          <Badge tone="neutral">{t.languages[story.language]}</Badge>
          {linkedRequestId && (
            <Link href={`${ROUTES.board}?selected=${linkedRequestId}`}>
              <Badge tone="primary">{t.story.requestBadge}</Badge>
            </Link>
          )}
          {canManage && (
            <Link href={ROUTES.manage(slug)} className="ml-auto">
              <Button variant="secondary" size="sm">
                {t.story.manageCta}
              </Button>
            </Link>
          )}
        </div>
        <h1 className="mb-5 max-w-175 text-[28px] font-extrabold leading-tight tracking-tight text-balance sm:text-[36px] lg:text-[44px]">
          {story.title}
        </h1>

        <div className="mb-6.5 flex flex-wrap gap-6 rounded-[20px] border border-border bg-card px-4.5 py-5 sm:gap-11 sm:px-6.5 sm:py-5.5">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="mb-0.5 text-2xl font-extrabold tracking-tight">{m.value}</div>
              <div className="text-[13px] text-muted-2">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="mb-8 max-w-190">
          <p className="text-[16px] leading-relaxed text-ink-soft">{story.description}</p>
        </div>

        <div className="mb-4 flex items-center gap-2.5 overflow-x-auto">
          <LinkChip href={`?tab=chapters`} scroll={false} active={tab === "chapters"} shrink>
            {t.story.chapters} <span className="ml-1 opacity-70">{chapters.length}</span>
          </LinkChip>
          <LinkChip href={`?tab=comments`} scroll={false} active={tab === "comments"} shrink>
            {t.common.comments} <span className="ml-1 opacity-70">{story.comment_count}</span>
          </LinkChip>
        </div>

        {tab === "chapters" && (
          <div className="overflow-hidden rounded-[20px] border border-border bg-card">
            {chapters.length > 0 ? (
              chapters.map((ch, i) => (
                <Link
                  key={ch.id}
                  href={ROUTES.chapter(slug, ch.order_index)}
                  className={clsxRow(i, chapters.length)}
                >
                  <span className="w-8 shrink-0 text-[14px] font-bold text-muted-3">{ch.order_index}</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[15px] font-semibold">{ch.title}</span>
                    <div className="mt-1 text-[12.5px] text-muted-3">{ch.word_count} {t.reader.wordsLabel}</div>
                  </div>
                  {ch.is_free && <Badge tone="primary">{t.common.read}</Badge>}
                </Link>
              ))
            ) : (
              <div className="px-6 py-10 text-center text-[14px] text-muted-2">
                {t.story.noChaptersBody}
              </div>
            )}
          </div>
        )}

        {tab === "comments" && (
          <div className="flex flex-col gap-3.5">
            {storyComments.length > 0 ? (
              storyComments.map((c) => (
                <div key={c.id} className="flex flex-col gap-2.5">
                  <StoryCommentCard comment={c} slug={slug} locale={locale} t={t} />
                  {c.replies.length > 0 && (
                    <div className="ml-10.5 flex flex-col gap-2.5">
                      {c.replies.map((r) => (
                        <StoryCommentCard key={r.id} comment={r} slug={slug} locale={locale} t={t} isReply />
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-[20px] border border-border bg-card px-6 py-10 text-center text-[14px] text-muted-2">
                {t.story.noCommentsYet}
              </div>
            )}
          </div>
        )}

        {!user && (
          <div className="mt-7 flex flex-col items-start gap-4 rounded-[22px] border border-primary-100 bg-linear-to-br from-primary-50 to-pink-bg px-5 py-5 sm:flex-row sm:items-center sm:gap-5 sm:px-7 sm:py-6">
            <div className="flex-1">
              <div className="mb-1 text-[17px] font-extrabold">{t.story.authorCta}</div>
              <div className="text-[14px] leading-relaxed text-ink-soft">{t.story.authorCtaBody}</div>
            </div>
            <Link href={ROUTES.onboarding} className="w-full shrink-0 sm:w-auto">
              <Button className="w-full justify-center sm:w-auto">{t.story.authorCtaButton}</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function clsxRow(index: number, total: number) {
  const border = index < total - 1 ? "border-b border-border-soft" : "";
  return `flex items-center gap-3.5 px-5.5 py-4 hover:bg-surface ${border}`;
}

function StoryCommentCard({
  comment,
  slug,
  locale,
  t,
  isReply,
}: {
  comment: StoryCommentRow;
  slug: string;
  locale: "ru" | "uz";
  t: Dictionary;
  isReply?: boolean;
}) {
  return (
    <Link
      href={comment.chapter ? `${ROUTES.chapter(slug, comment.chapter.order_index)}#comment-${comment.id}` : "#"}
      className={`flex gap-3.5 rounded-2xl border border-border p-4.5 hover:border-primary-300 ${isReply ? "bg-surface" : "bg-card"}`}
    >
      <Avatar name={comment.user?.display_name ?? "?"} size={isReply ? 32 : 38} />
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
          <span className="text-[14px] font-bold">{comment.user?.display_name}</span>
          <span className="text-[12.5px] text-muted-3">
            {new Date(comment.created_at).toLocaleDateString(locale)}
          </span>
          {!isReply && comment.chapter && (
            <Badge tone="neutral">
              {t.story.chapterBadge} {comment.chapter.order_index}
            </Badge>
          )}
        </div>
        <p className="text-[14.5px] leading-relaxed text-ink-soft">{comment.text}</p>
      </div>
    </Link>
  );
}
