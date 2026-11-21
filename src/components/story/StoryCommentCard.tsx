"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { formatDate } from "@/lib/format";
import { ROUTES } from "@/lib/constants";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Chip";
import { ReportCommentButton } from "@/components/story/ReportCommentButton";
import { CommentForm } from "@/components/story/CommentForm";
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
  storyId,
  path,
  blocked,
  onReplyPosted,
}: {
  comment: StoryCommentRow;
  slug: string;
  isReply?: boolean;
  viewerId?: string | null;
  // Present for the story page's own (chapterless) comments — the only ones
  // repliable/editable inline here. A chapter comment stays a link to its spot
  // in the chapter, where its own reply/edit live.
  storyId?: string;
  path?: string;
  blocked?: boolean;
  onReplyPosted?: () => void;
}) {
  const { t, locale } = useLocale();
  const [text, setText] = useState(comment.text);
  const [isSpoiler, setIsSpoiler] = useState(comment.is_spoiler);
  const [editedAt, setEditedAt] = useState(comment.edited_at);
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);

  const className = `flex gap-3.5 rounded-[12px] border border-border p-4.5 ${isReply ? "bg-surface" : "bg-card"}`;
  const isOwn = Boolean(viewerId && viewerId === comment.user_id);
  // Non-null only for the story page's own chapterless comments (storyId/path
  // narrow to string inside, so the forms below are type-safe).
  const interactiveProps =
    !comment.chapter && storyId !== undefined && path !== undefined ? { storyId, path } : null;

  const content = (
    <>
      <Avatar name={comment.user?.display_name ?? "?"} size={isReply ? 32 : 38} />
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
          <span className="text-[14px] font-bold">{comment.user?.display_name}</span>
          <span className="text-[12.5px] text-muted-3">{formatDate(comment.created_at, locale)}</span>
          {editedAt && <span className="text-[12px] text-muted-3">({t.common.edited})</span>}
          {!isReply && comment.chapter && (
            <Badge tone="neutral">
              {t.story.chapterBadge} {comment.chapter.order_index}
            </Badge>
          )}
        </div>

        {interactiveProps && editing ? (
          <CommentForm
            storyId={interactiveProps.storyId}
            chapterId={null}
            path={interactiveProps.path}
            editCommentId={comment.id}
            initialText={text}
            initialSpoiler={isSpoiler}
            autoFocus
            blocked={blocked}
            onCancel={() => setEditing(false)}
            onEdited={(newText, newSpoiler) => {
              setText(newText);
              setIsSpoiler(newSpoiler);
              setEditedAt(new Date().toISOString());
            }}
            onSuccess={() => setEditing(false)}
          />
        ) : (
          <p className="text-[14.5px] leading-relaxed text-ink-soft">{text}</p>
        )}

        {interactiveProps && !editing && (
          <div className="mt-2 flex flex-wrap items-center gap-4">
            {!isReply && viewerId && (
              <button
                type="button"
                onClick={() => setReplying((v) => !v)}
                className="cursor-pointer text-[13px] font-bold text-muted-2 hover:text-primary-800"
              >
                {t.manage.reply}
              </button>
            )}
            {isOwn && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="cursor-pointer text-[13px] font-bold text-muted-2 hover:text-primary-800"
              >
                {t.common.edit}
              </button>
            )}
            {viewerId && !isOwn && <ReportCommentButton commentId={comment.id} />}
          </div>
        )}

        {interactiveProps && replying && (
          <div className="mt-2.5">
            <CommentForm
              storyId={interactiveProps.storyId}
              chapterId={null}
              path={interactiveProps.path}
              parentId={comment.id}
              blocked={blocked}
              autoFocus
              onSuccess={() => {
                setReplying(false);
                onReplyPosted?.();
              }}
            />
          </div>
        )}
      </div>
    </>
  );

  // A general comment (posted from the story tab, not under a chapter) has
  // nowhere to jump to — render it as a plain (now interactive) block.
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
