"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { toggleCommentLike } from "@/lib/actions/social";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Avatar } from "@/components/ui/Avatar";
import { HeartIcon, EyeIcon } from "@/components/ui/icons";
import { CommentForm } from "@/components/story/CommentForm";
import type { CommentRow } from "@/lib/queries/social";

export function CommentItem({
  comment,
  replies,
  chapterId,
  path,
  locale,
  likedByMe,
  likedReplyIds,
  isReply,
}: {
  comment: CommentRow;
  replies?: CommentRow[];
  chapterId: string;
  path: string;
  locale: string;
  likedByMe: boolean;
  likedReplyIds?: Set<string>;
  isReply?: boolean;
}) {
  const { t } = useLocale();
  const [liked, setLiked] = useState(likedByMe);
  const [count, setCount] = useState(comment.like_count);
  const [replying, setReplying] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [, startTransition] = useTransition();

  function handleLike() {
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    startTransition(() => toggleCommentLike(comment.id, path));
  }

  return (
    <div id={`comment-${comment.id}`} className="scroll-mt-24 rounded-2xl [&:target]:bg-primary-50 [&:target]:ring-2 [&:target]:ring-primary-300">
      <div className="flex gap-3.5 rounded-2xl border border-border bg-card p-4.5">
        <Avatar name={comment.user?.display_name ?? "?"} size={38} />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2.5">
            <span className="text-[14px] font-bold">{comment.user?.display_name}</span>
            <span className="text-[12.5px] text-muted-3">
              {new Date(comment.created_at).toLocaleDateString(locale)}
            </span>
          </div>
          {comment.is_spoiler && !spoilerRevealed ? (
            <button
              type="button"
              onClick={() => setSpoilerRevealed(true)}
              className="mb-2.5 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-primary-300 bg-primary-50 px-3.5 py-2.5 text-[13px] font-bold text-primary-800 transition hover:bg-primary-100"
            >
              <EyeIcon width={16} height={16} />
              {t.reader.showSpoiler}
            </button>
          ) : (
            <p className="mb-2.5 text-[14.5px] leading-relaxed text-ink-soft">
              {comment.is_spoiler && (
                <span className="mr-1.5 rounded-md bg-danger-bg px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-danger">
                  {t.reader.spoilerBadge}
                </span>
              )}
              {comment.text}
            </p>
          )}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleLike}
              className={clsx(
                "flex cursor-pointer items-center gap-1.5 text-[13px] font-bold transition",
                liked ? "text-primary-700" : "text-muted-2"
              )}
            >
              <HeartIcon filled={liked} width={15} height={15} />
              <span>{count > 0 ? count : ""}</span>
            </button>
            {!isReply && (
              <button
                type="button"
                onClick={() => setReplying((v) => !v)}
                className="cursor-pointer text-[13px] font-bold text-muted-2 hover:text-primary-800"
              >
                {t.manage.reply}
              </button>
            )}
          </div>
        </div>
      </div>

      {replying && (
        <div className="ml-10.5 mt-2.5">
          <CommentForm chapterId={chapterId} path={path} parentId={comment.id} onSuccess={() => setReplying(false)} autoFocus />
        </div>
      )}

      {replies && replies.length > 0 && (
        <div className="ml-10.5 mt-2.5 flex flex-col gap-2.5">
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              chapterId={chapterId}
              path={path}
              locale={locale}
              likedByMe={likedReplyIds?.has(r.id) ?? false}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
}
