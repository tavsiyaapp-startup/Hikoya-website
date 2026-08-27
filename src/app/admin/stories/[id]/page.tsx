import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getStoryForModeration, getChaptersForModeration } from "@/lib/queries/admin";
import { ROUTES } from "@/lib/constants";
import { Badge } from "@/components/ui/Chip";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { StoryModerateActions } from "./StoryModerateActions";
import { StoryHideAction } from "./StoryHideAction";
import { ChapterModerateActions } from "./ChapterModerateActions";

function statusTone(status: string) {
  if (status === "published") return "success" as const;
  if (status === "pending_review") return "warning" as const;
  return "neutral" as const;
}

export default async function AdminStoryModeratePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  const [story, chapters] = await Promise.all([getStoryForModeration(id), getChaptersForModeration(id)]);
  if (!story) notFound();

  const author = story.author;
  const statusLabel: Record<string, string> = {
    published: t.common.published,
    pending_review: t.common.pendingReview,
    draft: t.common.draft,
    unlisted: t.common.unlisted,
  };

  return (
    <div>
      <div className="flex items-center gap-3.5 border-b border-border bg-card px-4 py-5.5 sm:px-8.5">
        <Link
          href={`${ROUTES.admin}/stories`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-ink-soft hover:bg-surface"
        >
          <ChevronLeftIcon />
        </Link>
        <h1 className="min-w-0 truncate text-[20px] font-extrabold tracking-tight sm:text-[24px]">{story.title}</h1>
      </div>

      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <div className="mb-6 flex flex-col gap-4.5 rounded-[22px] border border-border bg-card p-4.5 sm:flex-row sm:gap-6.5 sm:p-6.5">
          <div className="relative mx-auto h-42 w-31.5 shrink-0 overflow-hidden rounded-2xl bg-primary-200 sm:mx-0">
            {story.cover_url && <Image src={story.cover_url} alt="" fill className="object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <Badge tone={statusTone(story.status)}>{statusLabel[story.status] ?? story.status}</Badge>
              <Badge tone="pink">{story.genre}</Badge>
            </div>
            <div className="mb-3.5 text-[13.5px] text-muted-2">
              {t.admin.colAuthor}: <span className="font-semibold text-ink-soft">{author?.display_name}</span>{" "}
              <span className="text-muted-3">@{author?.username}</span>
            </div>
            <p className="mb-4.5 max-w-160 text-[14.5px] leading-relaxed text-ink-soft">{story.description}</p>

            {story.status === "draft" && story.rejection_reason && (
              <div className="mb-4.5 max-w-160 rounded-[14px] bg-danger-bg px-4 py-3">
                <div className="mb-1 text-[12.5px] font-bold text-danger">{t.manage.rejectionReasonLabel}</div>
                <p className="text-[13.5px] leading-relaxed text-ink-soft">{story.rejection_reason}</p>
              </div>
            )}

            {story.status === "pending_review" && (
              <StoryModerateActions storyId={story.id} storySlug={story.slug} />
            )}
            {(story.status === "published" || story.status === "unlisted") && (
              <StoryHideAction storyId={story.id} storySlug={story.slug} />
            )}
          </div>
        </div>

        <h2 className="mb-3.5 text-[18px] font-extrabold tracking-tight">{t.story.chapters}</h2>
        <div className="overflow-hidden rounded-[22px] border border-border bg-card">
          {chapters.length > 0 ? (
            chapters.map((ch, i) => (
              <div
                key={ch.id}
                className={`flex flex-col gap-3 px-5.5 py-4.5 ${
                  i < chapters.length - 1 ? "border-b border-border-soft" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-3.5">
                  <span className="w-6 shrink-0 text-[13.5px] font-bold text-muted-3">{ch.order_index}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-bold">{ch.title}</div>
                    <div className="text-[12.5px] text-muted-3">
                      {ch.word_count} {t.reader.wordsLabel}
                    </div>
                  </div>
                  <Badge tone={statusTone(ch.status)}>{statusLabel[ch.status] ?? ch.status}</Badge>
                  <Link
                    href={ROUTES.adminChapter(story.id, ch.id)}
                    className="text-[12.5px] font-bold text-primary-800"
                  >
                    {t.admin.readChapter}
                  </Link>
                </div>
                {ch.status === "draft" && ch.rejection_reason && (
                  <div className="rounded-[12px] bg-danger-bg px-3.5 py-2.5">
                    <div className="mb-0.5 text-[12px] font-bold text-danger">{t.manage.rejectionReasonLabel}</div>
                    <p className="text-[13px] leading-relaxed text-ink-soft">{ch.rejection_reason}</p>
                  </div>
                )}
                {ch.status === "pending_review" && (
                  <ChapterModerateActions chapterId={ch.id} storyId={story.id} storySlug={story.slug} />
                )}
              </div>
            ))
          ) : (
            <div className="px-6 py-10 text-center text-[14px] text-muted-2">{t.manage.noChaptersYet}</div>
          )}
        </div>
      </div>
    </div>
  );
}
