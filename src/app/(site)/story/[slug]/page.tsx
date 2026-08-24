import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { getStoryBySlug, getChaptersForStory } from "@/lib/queries/stories";
import { getUserStoryState, isFollowingAuthor, getFollowerCount } from "@/lib/queries/social";
import { ROUTES } from "@/lib/constants";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { LikeBookmarkRow, FollowButton } from "@/components/story/StoryActions";

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const user = await getCurrentUser();

  const story = await getStoryBySlug(slug);
  if (!story) notFound();

  const [chapters, social, following, followerCount] = await Promise.all([
    getChaptersForStory(story.id),
    getUserStoryState(user?.id, story.id),
    isFollowingAuthor(user?.id, story.author.id),
    getFollowerCount(story.author.id),
  ]);

  const path = ROUTES.story(slug);
  const firstChapter = chapters[0];
  const metrics = [
    { label: t.common.views, value: story.view_count },
    { label: t.common.like, value: story.like_count },
    { label: t.common.comments, value: story.comment_count },
    { label: t.story.chapters, value: chapters.length },
  ];

  return (
    <div className="flex items-start gap-9">
      <div className="sticky top-26 w-75 shrink-0">
        <div className="relative mb-4.5 aspect-[3/4] overflow-hidden rounded-[22px] bg-primary-200 shadow-[0_18px_40px_rgba(60,40,120,0.18)]">
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
            Пока нет опубликованных глав
          </div>
        )}

        <LikeBookmarkRow
          storyId={story.id}
          isAuthenticated={Boolean(user)}
          initialLiked={social.liked}
          initialBookmarked={social.bookmarked}
          path={path}
        />

        <div className="rounded-[18px] border border-border bg-card p-4.5">
          <Link href={ROUTES.author(story.author.username)} className="mb-3.5 flex items-center gap-2.5">
            <Avatar name={story.author.display_name} />
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
          <Badge tone={story.age_rating === "18+" ? "danger" : "neutral"}>{story.age_rating}</Badge>
          <Badge tone="success">{story.status === "published" ? t.common.ongoing : t.common.finished}</Badge>
          <Badge tone="neutral">{t.languages[story.language]}</Badge>
        </div>
        <h1 className="mb-5 max-w-175 text-[44px] font-extrabold leading-tight tracking-tight text-balance">
          {story.title}
        </h1>

        <div className="mb-6.5 flex gap-11 rounded-[20px] border border-border bg-card px-6.5 py-5.5">
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

        <div className="mb-4 flex items-center gap-3.5">
          <h2 className="text-2xl font-extrabold tracking-tight">{t.story.chapters}</h2>
          <span className="text-[13.5px] text-muted-2">{chapters.length}</span>
        </div>

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
                  <div className="mt-1 text-[12.5px] text-muted-3">{ch.word_count} слов</div>
                </div>
                {ch.is_free && <Badge tone="primary">{t.common.read}</Badge>}
              </Link>
            ))
          ) : (
            <div className="px-6 py-10 text-center text-[14px] text-muted-2">
              Автор ещё не опубликовал ни одной главы.
            </div>
          )}
        </div>

        {!user && (
          <div className="mt-7 flex items-center gap-5 rounded-[22px] border border-primary-100 bg-linear-to-br from-primary-50 to-pink-bg px-7 py-6">
            <div className="flex-1">
              <div className="mb-1 text-[17px] font-extrabold">{t.story.authorCta}</div>
              <div className="text-[14px] leading-relaxed text-ink-soft">{t.story.authorCtaBody}</div>
            </div>
            <Link href={ROUTES.onboarding} className="shrink-0">
              <Button>{t.story.authorCtaButton}</Button>
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
