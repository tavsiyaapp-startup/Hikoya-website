"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { formatDate } from "@/lib/format";
import { ROUTES } from "@/lib/constants";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Chip";
import { ReportCommentButton } from "@/components/story/ReportCommentButton";
import type { StoryCommentRow } from "@/lib/queries/social";

// Client version of the story-page comment card (the server component that used
// to live inline in story/[slug]/page.tsx). It moved client-side so the Comments
// tab can switch instantly and load its list on demand — see StoryTabs. It's
// presentational; the one interactive bit (report) is the already-client
// ReportCommentButton, and locale/dictionary come from the LocaleProvider.
export function StoryCommentCard({
  comment,
  slug,
  isReply,
  viewerId,
}: {
  comment: StoryCommentRow;
  slug: string;
  isReply?: boolean;
  viewerId?: string | null;
}) {
  const { t, locale } = useLocale();
  const className = `flex gap-3.5 rounded-[12px] border border-border p-4.5 ${isReply ? "bg-surface" : "bg-card"}`;
  const content = (
    <>
      <Avatar name={comment.user?.display_name ?? "?"} size={isReply ? 32 : 38} />
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
          <span className="text-[14px] font-bold">{comment.user?.display_name}</span>
          <span className="text-[12.5px] text-muted-3">{formatDate(comment.created_at, locale)}</span>
          {!isReply && comment.chapter && (
            <Badge tone="neutral">
              {t.story.chapterBadge} {comment.chapter.order_index}
            </Badge>
          )}
        </div>
        <p className="text-[14.5px] leading-relaxed text-ink-soft">{comment.text}</p>
        {!comment.chapter && viewerId && viewerId !== comment.user_id && (
          <div className="mt-2">
            <ReportCommentButton commentId={comment.id} />
          </div>
        )}
      </div>
    </>
  );

  // A general comment (posted from the story tab, not under a chapter) has
  // nowhere to jump to — render it as a plain block instead of a dead link.
  if (!comment.chapter) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link
      prefetch={false}
      href={`${ROUTES.chapter(slug, comment.chapter.order_index)}#comment-${comment.id}`}
      className={`${className} hover:border-primary-300`}
    >
      {content}
    </Link>
  );
}
