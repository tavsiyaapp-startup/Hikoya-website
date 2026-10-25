"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  deleteForumCommentAction,
  hideForumCommentAction,
  postForumComment,
  reportForumItemAction,
  toggleForumCommentLikeAction,
} from "@/lib/actions/forum";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { formatRelativeTime } from "@/lib/format";
import { ROUTES } from "@/lib/constants";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { HeartIcon } from "@/components/ui/icons";
import { EmojiPickerButton } from "@/components/story/EmojiPickerButton";
import { ReportCommentButton } from "@/components/story/ReportCommentButton";
import type { ForumCommentItem } from "@/server/data/forum";

const MAX_COMMENT = 5000;

export interface ForumViewer {
  id: string;
  isStaff: boolean;
  active: boolean;
}

interface Shared {
  postId: string;
  postAuthorId: string;
  viewer: ForumViewer | null;
  canComment: boolean;
  myStories: { id: string; title: string }[];
}

function CommentForm({
  postId,
  parentId,
  myStories,
  autoFocus,
  onDone,
}: {
  postId: string;
  parentId?: string;
  myStories: { id: string; title: string }[];
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [text, setText] = useState("");
  const [storyId, setStoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await postForumComment(postId, text, parentId ?? null, storyId || null);
      if ("ok" in result) {
        setText("");
        setStoryId("");
        onDone?.();
        router.refresh();
        return;
      }
      setError(
        result.error === "too_fast"
          ? t.forum.errTooFast
          : result.error === "blocked"
            ? t.forum.errBlocked
            : result.error === "rate_limited"
              ? t.forum.errRate
              : result.error === "story"
                ? t.forum.errStory
                : t.forum.errGeneric
      );
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <div className="flex items-start gap-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={parentId ? t.forum.replyPlaceholder : t.forum.commentPlaceholder}
          rows={parentId ? 2 : 3}
          maxLength={MAX_COMMENT}
          autoFocus={autoFocus}
          className="flex-1"
        />
        <EmojiPickerButton onSelect={(emoji) => setText((v) => v + emoji)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {myStories.length > 0 && !parentId ? (
          <select
            value={storyId}
            onChange={(e) => setStoryId(e.target.value)}
            aria-label={t.forum.attachStory}
            className="h-10 min-w-0 max-w-full flex-1 rounded-[10px] border border-border bg-card px-2.5 text-[13.5px] outline-none sm:max-w-80"
          >
            <option value="">{t.forum.attachStory}</option>
            {myStories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        ) : (
          <span />
        )}
        <Button type="submit" size="sm" disabled={pending || !text.trim()} className="shrink-0">
          {pending ? t.common.loading : parentId ? t.forum.reply : t.forum.send}
        </Button>
      </div>
      {error && <p className="text-[12.5px] font-semibold text-danger">{error}</p>}
    </form>
  );
}

function CommentCard({
  comment,
  shared,
  isReply,
  onReply,
}: {
  comment: ForumCommentItem;
  shared: Shared;
  isReply?: boolean;
  onReply?: () => void;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [liked, setLiked] = useState(comment.likedByMe);
  const [likes, setLikes] = useState(comment.like_count);
  const [pending, startTransition] = useTransition();
  const { viewer } = shared;
  const own = viewer?.id === comment.author.id;
  const canLike = Boolean(viewer?.active) && !own && !comment.hidden;

  function like() {
    if (!canLike) return;
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    startTransition(async () => {
      const result = await toggleForumCommentLikeAction(comment.id);
      if (!result) {
        setLiked(!next);
        setLikes((n) => n + (next ? -1 : 1));
        return;
      }
      setLiked(result.liked);
      setLikes(result.count);
    });
  }

  function remove() {
    if (!window.confirm(t.forum.deleteConfirm)) return;
    startTransition(async () => {
      await deleteForumCommentAction(comment.id);
      router.refresh();
    });
  }

  function hide() {
    startTransition(async () => {
      await hideForumCommentAction(comment.id);
      router.refresh();
    });
  }

  return (
    <div id={`c-${comment.id}`} className="scroll-mt-28 rounded-[12px] [&:target]:ring-2 [&:target]:ring-primary-300">
      <div className={clsx("flex gap-3 rounded-[12px] border p-3.5 sm:p-4", comment.hidden ? "border-danger/40 bg-danger-bg/40" : "border-border bg-card")}>
        <Link prefetch={false} href={ROUTES.author(comment.author.username)} className="shrink-0">
          <Avatar name={comment.author.display_name} src={comment.author.avatar_url} size={isReply ? 30 : 36} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link prefetch={false} href={ROUTES.author(comment.author.username)} className="text-[14px] font-bold hover:text-primary-800">
              {comment.author.display_name}
            </Link>
            {comment.author.id === shared.postAuthorId && <Badge tone="primary" className="px-2 py-0.5 text-[11px]">{t.forum.opBadge}</Badge>}
            {comment.byFollowed && <Badge tone="success" className="px-2 py-0.5 text-[11px]">{t.forum.followedBadge}</Badge>}
            {comment.hidden && <Badge tone="danger" className="px-2 py-0.5 text-[11px]">{t.forum.hiddenBadge}</Badge>}
            <span className="text-[12px] text-muted-3">{formatRelativeTime(comment.created_at, locale)}</span>
          </div>
          <p className="whitespace-pre-line break-words text-[14.5px] leading-relaxed text-ink-soft">{comment.body}</p>
          {comment.story && (
            <Link
              prefetch={false}
              href={ROUTES.story(comment.story.slug)}
              className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-[9px] bg-surface px-2.5 py-1.5 text-[12.5px] font-bold text-primary-800 hover:bg-primary-50"
            >
              📖 <span className="truncate">{t.forum.readStory}: {comment.story.title}</span>
            </Link>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <button
              type="button"
              onClick={like}
              disabled={!canLike || pending}
              title={own ? t.forum.ownTopicVote : undefined}
              className={clsx(
                "flex items-center gap-1.5 text-[13px] font-bold transition",
                liked ? "text-primary-700" : "text-muted-2",
                canLike ? "cursor-pointer hover:text-primary-700" : "cursor-default"
              )}
            >
              <HeartIcon filled={liked} width={15} height={15} />
              <span>{likes > 0 ? likes : ""}</span>
            </button>
            {onReply && shared.canComment && (
              <button type="button" onClick={onReply} className="cursor-pointer text-[13px] font-bold text-muted-2 hover:text-primary-800">
                {t.forum.reply}
              </button>
            )}
            {(own || viewer?.isStaff) && (
              <button type="button" onClick={remove} disabled={pending} className="cursor-pointer text-[13px] font-bold text-muted-3 hover:text-danger">
                {t.forum.delete}
              </button>
            )}
            {viewer?.isStaff && !comment.hidden && !own && (
              <button type="button" onClick={hide} disabled={pending} className="cursor-pointer text-[13px] font-bold text-muted-3 hover:text-danger">
                {t.forum.hide}
              </button>
            )}
            {viewer && !own && !comment.hidden && (
              <ReportCommentButton
                commentId={comment.id}
                send={(reason, details) => reportForumItemAction({ commentId: comment.id }, reason, details)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// A top-level comment with its replies. Answering a reply still lands in
// this same thread (one level, like Threads); the server notifies the
// person whose comment was answered.
function Thread({ comment, shared }: { comment: ForumCommentItem; shared: Shared }) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const toggle = (id: string) => setReplyTo((current) => (current === id ? null : id));
  return (
    <div>
      <CommentCard comment={comment} shared={shared} onReply={() => toggle(comment.id)} />
      {(comment.replies.length > 0 || replyTo) && (
        <div className="ml-5 mt-2 flex flex-col gap-2 border-l-2 border-border-soft pl-3 sm:ml-8 sm:pl-4">
          {comment.replies.map((r) => (
            <CommentCard key={r.id} comment={r} shared={shared} isReply onReply={() => toggle(r.id)} />
          ))}
          {replyTo && (
            <CommentForm key={replyTo} postId={shared.postId} parentId={replyTo} myStories={[]} autoFocus onDone={() => setReplyTo(null)} />
          )}
        </div>
      )}
    </div>
  );
}

export function ForumComments({
  comments,
  locked,
  ...shared
}: Shared & { comments: ForumCommentItem[]; locked: boolean }) {
  const { t } = useLocale();
  const { viewer } = shared;

  return (
    <div className="flex flex-col gap-4">
      {!viewer ? (
        <Link prefetch={false} href={ROUTES.onboarding}>
          <Button variant="secondary" className="w-full justify-center">
            {t.forum.signInToComment}
          </Button>
        </Link>
      ) : !viewer.active ? (
        <p className="rounded-[12px] bg-danger-bg px-4 py-3 text-[13.5px] font-semibold text-danger">{t.forum.errBlocked}</p>
      ) : shared.canComment ? (
        <div className="rounded-[14px] border border-border bg-card p-3.5 sm:p-4">
          <CommentForm postId={shared.postId} myStories={shared.myStories} />
        </div>
      ) : null}
      {locked && <p className="rounded-[12px] bg-surface px-4 py-3 text-[13.5px] font-semibold text-muted-2">🔒 {t.forum.lockedNotice}</p>}

      {comments.length > 0 ? (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <Thread key={c.id} comment={c} shared={shared} />
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-[14px] text-muted">{t.forum.noComments}</p>
      )}
    </div>
  );
}
