import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { getStoryBySlug, getChaptersForStory, getTagsForStory, getAllTags } from "@/lib/queries/stories";
import { getLinkedRequestForStory } from "@/lib/queries/requests";
import { ROUTES } from "@/lib/constants";
import { localizeGenre } from "@/lib/genre";
import { Badge, Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { AddChapterForm } from "@/components/manage/AddChapterForm";
import { ChapterRow } from "@/components/manage/ChapterRow";
import { EditStoryForm } from "@/components/manage/EditStoryForm";
import { StoryModerationActions } from "@/components/manage/StoryModerationActions";
import { DeleteStoryButton } from "@/components/manage/DeleteStoryButton";

const TABS = ["chapters", "edit"] as const;
type Tab = (typeof TABS)[number];

export default async function ManagePage({
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
  if (!user) redirect(`${ROUTES.onboarding}?next=${encodeURIComponent(ROUTES.manage(slug))}`);

  const story = await getStoryBySlug(slug);
  if (!story) notFound();
  if (story.author.id !== user.id) redirect(ROUTES.home);

  const [chapters, tags, existingTags, linkedRequestId] = await Promise.all([
    getChaptersForStory(story.id, true),
    tab === "edit" ? getTagsForStory(story.id) : Promise.resolve([]),
    tab === "edit" ? getAllTags() : Promise.resolve([]),
    getLinkedRequestForStory(story.id),
  ]);

  const metrics = [
    { label: t.common.views, value: story.view_count },
    { label: t.common.like, value: story.like_count },
    { label: t.common.comments, value: story.comment_count },
    { label: t.story.chapters, value: chapters.length },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4.5 rounded-3xl border border-border bg-card p-4.5 sm:flex-row sm:gap-6.5 sm:p-6.5">
        <div className="relative mx-auto h-42 w-31.5 shrink-0 overflow-hidden rounded-2xl bg-primary-200 shadow-[0_10px_24px_rgba(60,40,120,0.16)] sm:mx-0 sm:h-50 sm:w-37.5">
          {story.cover_url && <Image src={story.cover_url} alt="" fill className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <Badge
              tone={
                story.status === "published" ? "success" : story.status === "pending_review" ? "warning" : "neutral"
              }
            >
              {story.status === "published"
                ? t.common.published
                : story.status === "pending_review"
                  ? t.common.pendingReview
                  : t.common.draft}
            </Badge>
            <Badge tone="pink">{localizeGenre(story.genre, locale)}</Badge>
            {linkedRequestId && (
              <Link href={`${ROUTES.board}?selected=${linkedRequestId}`}>
                <Badge tone="primary">{t.story.requestBadge}</Badge>
              </Link>
            )}
          </div>
          <h1 className="mb-4.5 text-[24px] font-extrabold tracking-tight sm:text-[34px]">{story.title}</h1>
          <div className="mb-4.5 flex flex-wrap gap-6 sm:gap-10">
            {metrics.map((m) => (
              <div key={m.label}>
                <div className="mb-0.5 text-[22px] font-extrabold">{m.value}</div>
                <div className="text-[12.5px] text-muted-2">{m.label}</div>
              </div>
            ))}
          </div>
          {story.status === "pending_review" && (
            <p className="mb-3 text-[13px] text-muted-2">{t.manage.pendingReviewNotice}</p>
          )}
          {story.status === "draft" && story.rejection_reason && (
            <div className="mb-3 rounded-[14px] bg-danger-bg px-4 py-3">
              <div className="mb-1 text-[12.5px] font-bold text-danger">
                {story.published_at ? t.manage.hiddenReasonLabel : t.manage.rejectionReasonLabel}
              </div>
              <p className="text-[13.5px] leading-relaxed text-ink-soft">{story.rejection_reason}</p>
            </div>
          )}
          <StoryModerationActions storyId={story.id} storySlug={slug} status={story.status} />
        </div>
      </div>

      <div className="mb-4.5 flex flex-wrap items-center gap-2.5">
        {(
          [
            ["chapters", t.manage.tabChapters],
            ["edit", t.manage.editStory],
          ] as const
        ).map(([key, label]) => (
          <Link key={key} href={`?tab=${key}`}>
            <Chip active={tab === key}>{label}</Chip>
          </Link>
        ))}
      </div>

      {tab === "chapters" && (
        <div className="mb-4.5 flex flex-wrap justify-end gap-2.5">
          <Link href={`${ROUTES.manage(slug)}/import`}>
            <Button variant="secondary">{t.manage.importDocument}</Button>
          </Link>
          <AddChapterForm storyId={story.id} storySlug={slug} />
        </div>
      )}

      {tab === "chapters" && (
        <div className="overflow-hidden rounded-[22px] border border-border bg-card">
          {chapters.length > 0 ? (
            chapters.map((ch, i) => (
              <ChapterRow
                key={ch.id}
                chapter={ch}
                storyId={story.id}
                storySlug={slug}
                isLast={i === chapters.length - 1}
              />
            ))
          ) : (
            <div className="px-6 py-10 text-center text-[14px] text-muted-2">
              {t.manage.noChaptersYet}
            </div>
          )}
        </div>
      )}

      {tab === "edit" && (
        <>
          <EditStoryForm
            storyId={story.id}
            storySlug={slug}
            authorId={story.author.id}
            initialCoverUrl={story.cover_url}
            initialGenre={localizeGenre(story.genre, locale)}
            initialRelationshipType={story.relationship_type}
            initialDescription={story.description}
            initialProgressStatus={story.progress_status}
            initialIsTranslation={story.is_translation}
            initialTags={tags}
            existingTags={existingTags}
          />
          <DeleteStoryButton storyId={story.id} storySlug={slug} storyTitle={story.title} />
        </>
      )}
    </div>
  );
}
