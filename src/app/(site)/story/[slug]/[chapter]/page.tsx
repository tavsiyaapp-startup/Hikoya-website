import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import {
  getStoryBySlug,
  getChaptersForStory,
  getChapter,
  getGuestFreeChapterCount,
} from "@/lib/queries/stories";
import { getChapterComments } from "@/lib/queries/social";
import { ROUTES } from "@/lib/constants";
import { ChevronLeftIcon, LockIcon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ChapterReadingRecorder } from "@/components/story/ChapterReadingRecorder";
import { CommentForm } from "@/components/story/CommentForm";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>;
}) {
  const { slug, chapter } = await params;
  const orderIndex = Number(chapter);
  if (!Number.isFinite(orderIndex)) notFound();

  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const user = await getCurrentUser();

  const story = await getStoryBySlug(slug);
  if (!story) notFound();

  const [ch, allChapters, freeLimit] = await Promise.all([
    getChapter(story.id, orderIndex),
    getChaptersForStory(story.id),
    getGuestFreeChapterCount(),
  ]);
  if (!ch) notFound();

  const isUnlocked = Boolean(user) || ch.is_free || ch.order_index <= freeLimit;
  const comments = isUnlocked ? await getChapterComments(ch.id) : [];

  const idx = allChapters.findIndex((c) => c.id === ch.id);
  const prevChapter = idx > 0 ? allChapters[idx - 1] : null;
  const nextChapter = idx >= 0 && idx < allChapters.length - 1 ? allChapters[idx + 1] : null;

  const readMinutes = Math.max(1, Math.round(ch.word_count / 200));
  const paragraphs = ch.content.split(/\n+/).filter(Boolean);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:justify-center lg:gap-9">
      {isUnlocked && (
        <ChapterReadingRecorder
          chapterId={ch.id}
          storyId={story.id}
          orderIndex={ch.order_index}
          totalChapters={allChapters.length}
        />
      )}

      <div className="min-w-0 w-full lg:max-w-190 lg:flex-1">
        <Link
          href={ROUTES.story(slug)}
          className="mb-5 inline-flex items-center gap-2 text-[14px] font-semibold"
        >
          <ChevronLeftIcon />
          <span>{story.title}</span>
        </Link>

        <div className="mb-2.5 text-[14px] font-bold text-muted-2">
          {t.reader.chapterLabel} {ch.order_index}
        </div>
        <h1 className="mb-4.5 text-[26px] font-extrabold leading-tight tracking-tight sm:text-[32px] lg:text-[40px]">{ch.title}</h1>
        <div className="mb-7.5 flex flex-wrap gap-5 border-b border-border pb-5.5 text-[13.5px] text-muted-2">
          <span>{ch.word_count} {t.reader.wordsLabel}</span>
          <span>{readMinutes} {t.reader.readTimeLabel}</span>
          {isUnlocked && !user && (
            <span className="font-bold text-success">{t.reader.freeLabel}</span>
          )}
        </div>

        {isUnlocked ? (
          <div className="text-[17px] leading-8 text-ink-soft">
            {paragraphs.map((p, i) => (
              <p key={i} className="mb-4.5">
                {p}
              </p>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-linear-to-br from-ink-dark to-primary-950 px-5 py-6 text-white sm:px-9 sm:py-8.5">
            <div className="mb-3.5 flex items-center gap-3">
              <LockIcon className="h-5.5 w-5.5 text-primary-300" />
              <span className="text-[13px] font-bold uppercase tracking-wide text-primary-300">
                {t.reader.chapterLabel} {ch.order_index} {t.reader.gateLockedBadge}
              </span>
            </div>
            <h3 className="mb-2.5 text-[26px] font-extrabold tracking-tight">{t.reader.gateTitle}</h3>
            <p className="mb-6 max-w-130 text-[15px] leading-relaxed text-primary-200">
              {t.reader.gateBody}
            </p>
            <Link href={`${ROUTES.onboarding}?next=${encodeURIComponent(ROUTES.chapter(slug, orderIndex))}`}>
              <Button style={{ background: "#fff", color: "#3B2568" }} className="border-none">
                {t.common.createAccount}
              </Button>
            </Link>
          </div>
        )}

        {isUnlocked && nextChapter && (
          <Link
            href={ROUTES.chapter(slug, nextChapter.order_index)}
            className="mt-9 flex w-full items-center justify-center gap-3 rounded-[18px] border border-primary-200 bg-primary-50 py-5 text-[16px] font-bold text-primary-900"
          >
            <span>{t.reader.continueNext}</span>
          </Link>
        )}

        {isUnlocked && (
          <div className="mt-11">
            <div className="mb-5 flex items-center gap-3.5">
              <h2 className="text-[22px] font-extrabold">{t.reader.commentsTitle}</h2>
              <span className="text-[14px] text-muted-2">{comments.length}</span>
            </div>

            {user ? (
              <CommentForm chapterId={ch.id} path={ROUTES.chapter(slug, orderIndex)} />
            ) : (
              <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-primary-300 bg-card px-5 py-4">
                <LockIcon className="text-muted-2" />
                <span className="text-[14px] text-ink-soft">{t.reader.commentsLocked}</span>
                <Link href={ROUTES.onboarding} className="ml-auto">
                  <Button size="sm">{t.common.login}</Button>
                </Link>
              </div>
            )}

            <div className="flex flex-col gap-3.5">
              {comments.map((c) => {
                const author = c.user as unknown as { display_name: string } | null;
                return (
                  <div key={c.id} className="flex gap-3.5 rounded-2xl border border-border bg-card p-4.5">
                    <Avatar name={author?.display_name ?? "?"} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center gap-2.5">
                        <span className="text-[14px] font-bold">{author?.display_name}</span>
                        <span className="text-[12.5px] text-muted-3">
                          {new Date(c.created_at).toLocaleDateString(locale)}
                        </span>
                      </div>
                      <p className="text-[14.5px] leading-relaxed text-ink-soft">{c.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex w-full flex-col gap-4 lg:sticky lg:top-26 lg:w-74 lg:shrink-0">
        <div className="rounded-[20px] border border-border bg-card p-4.5">
          <Link href={ROUTES.author(story.author.username)} className="flex items-center gap-3">
            <Avatar name={story.author.display_name} src={story.author.avatar_url} />
            <div>
              <div className="text-[14.5px] font-bold">{story.author.display_name}</div>
              <div className="text-[12.5px] text-muted-2">{t.story.authorLabel}</div>
            </div>
          </Link>
        </div>

        {prevChapter && (
          <Link
            href={ROUTES.chapter(slug, prevChapter.order_index)}
            className="rounded-[20px] border border-border bg-card p-4.5 text-[13.5px] font-semibold text-ink-soft"
          >
            ← {prevChapter.title}
          </Link>
        )}
      </div>
    </div>
  );
}
