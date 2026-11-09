import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getChapterForModeration, getStoryForModeration } from "@/lib/queries/admin";
import { sanitizeHtml } from "@/lib/sanitize";
import { ROUTES } from "@/lib/constants";
import { Badge } from "@/components/ui/Chip";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { ChapterModerateActions } from "../../ChapterModerateActions";
import { plural } from "@/lib/plural";
import { formatDateTime } from "@/lib/format";

/* eslint-disable @next/next/no-img-element */

// Manga page images go through /thumb at reading width (same as the public
// reader) so the admin preview stays light.
function readSrc(url: string, w: number): string {
  return url.startsWith("/uploads/") ? `/thumb/${url.slice("/uploads/".length)}?w=${w}` : url;
}

export default async function AdminChapterModeratePage({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>;
}) {
  const { id, chapterId } = await params;
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  const [story, chapter] = await Promise.all([getStoryForModeration(id), getChapterForModeration(chapterId)]);
  if (!story || !chapter || chapter.story_id !== id) notFound();

  const pages = chapter.pages ?? [];
  const isManga = pages.length > 0;
  const isRichContent = /<[a-z][\s\S]*>/i.test(chapter.content);
  const paragraphs = isRichContent ? [] : chapter.content.split(/\n+/).filter(Boolean);
  const statusLabel: Record<string, string> = {
    published: t.common.published,
    pending_review: t.common.pendingReview,
    draft: t.common.draft,
  };

  return (
    <div>
      <div className="flex items-center gap-3.5 border-b border-border bg-card px-4 py-5.5 sm:px-8.5">
        <Link prefetch={false}
          href={ROUTES.adminStory(id)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-ink-soft hover:bg-surface"
        >
          <ChevronLeftIcon />
        </Link>
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-semibold text-muted-2">{story.title}</div>
          <h1 className="min-w-0 truncate text-[19px] font-extrabold tracking-tight sm:text-[22px]">
            {chapter.title}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-190 px-4 pb-15 pt-7 sm:px-8.5">
        <div className="mb-6 flex flex-wrap items-center gap-3.5 text-[13.5px] text-muted-2">
          <Badge tone={chapter.status === "published" ? "success" : chapter.status === "pending_review" ? "warning" : "neutral"}>
            {statusLabel[chapter.status] ?? chapter.status}
          </Badge>
          <span>
            {isManga
              ? `${pages.length} sahifa`
              : `${chapter.word_count} ${plural(chapter.word_count, t.reader.wordsLabel)}`}
          </span>
          {chapter.published_at && (
            <span>{t.admin.publishedOnLabel}: {formatDateTime(chapter.published_at, locale)}</span>
          )}
          <span>{t.admin.editedOnLabel}: {formatDateTime(chapter.updated_at, locale)}</span>
        </div>

        {chapter.status === "draft" && chapter.rejection_reason && (
          <div className="mb-6 rounded-[14px] bg-danger-bg px-4 py-3">
            <div className="mb-1 text-[12.5px] font-bold text-danger">{t.manage.rejectionReasonLabel}</div>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">{chapter.rejection_reason}</p>
          </div>
        )}

        {isManga ? (
          <div className="mx-auto mb-9 flex max-w-[820px] flex-col overflow-hidden rounded-[12px] bg-[#0b0b0f]">
            {pages.map((p, i) => (
              <img
                key={p.url}
                src={readSrc(p.url, 1080)}
                alt={`Sahifa ${i + 1}`}
                loading={i < 2 ? "eager" : "lazy"}
                className="block w-full"
              />
            ))}
          </div>
        ) : isRichContent ? (
          <div
            className="rich-content mb-9 text-[16px] leading-8 text-ink-soft"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(chapter.content) }}
          />
        ) : (
          <div className="mb-9 text-[16px] leading-8 text-ink-soft">
            {paragraphs.map((p, i) => (
              <p key={i} className="mb-4.5">
                {p}
              </p>
            ))}
          </div>
        )}

        {chapter.status === "pending_review" && (
          <ChapterModerateActions chapterId={chapter.id} storyId={id} storySlug={story.slug} />
        )}
      </div>
    </div>
  );
}
