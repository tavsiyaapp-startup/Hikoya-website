"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { markNotificationRead } from "@/lib/actions/notifications";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";
import { HeartIcon, MessageIcon, ShieldIcon } from "@/components/ui/icons";
import type { NotificationWithContext } from "@/lib/queries/notifications";

function notificationHref(n: NotificationWithContext): string {
  if (!n.story) return ROUTES.home;
  if (n.type === "story_rejected" || n.type === "story_hidden" || n.type === "chapter_rejected")
    return ROUTES.manage(n.story.slug);
  if (!n.chapter) return ROUTES.story(n.story.slug);
  const base = ROUTES.chapter(n.story.slug, n.chapter.order_index);
  return n.comment_id ? `${base}#comment-${n.comment_id}` : base;
}

function NotificationIcon({ type }: { type: NotificationWithContext["type"] }) {
  if (type === "comment_like" || type === "story_like") return <HeartIcon filled className="text-primary-600" />;
  if (type === "new_comment" || type === "comment_reply") return <MessageIcon className="text-primary-600" />;
  return <ShieldIcon className="text-primary-600" width={16} height={16} />;
}

export function NotificationItem({
  notification,
  locale,
}: {
  notification: NotificationWithContext;
  locale: "ru" | "uz";
}) {
  const { t } = useLocale();
  const n = notification;
  const [isRead, setIsRead] = useState(n.is_read);
  const [, startTransition] = useTransition();

  const actorName = n.actor?.display_name;
  const chapterTitle = n.chapter?.title;
  const storyTitle = n.story?.title;

  function handleMarkRead() {
    setIsRead(true);
    startTransition(() => markNotificationRead(n.id));
  }

  return (
    <div
      className={`flex items-start gap-3.5 rounded-2xl border p-4.5 transition ${
        isRead ? "border-border bg-card" : "border-primary-200 bg-primary-50"
      }`}
    >
      <Link href={notificationHref(n)} className="flex min-w-0 flex-1 gap-3.5">
        <span className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full bg-white">
          <NotificationIcon type={n.type} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] leading-relaxed text-ink-soft">
            {n.type === "new_comment" && (
              <>
                <b className="text-ink">{actorName}</b> {t.notifications.newComment}{" "}
                {chapterTitle && <>«{chapterTitle}»</>}
              </>
            )}
            {n.type === "comment_reply" && (
              <>
                <b className="text-ink">{actorName}</b> {t.notifications.commentReply}
              </>
            )}
            {n.type === "comment_like" && (
              <>
                <b className="text-ink">{actorName}</b> {t.notifications.commentLike}
              </>
            )}
            {n.type === "story_like" && (
              <>
                <b className="text-ink">{actorName}</b> {t.notifications.storyLike}{" "}
                {storyTitle && <>«{storyTitle}»</>}
              </>
            )}
            {n.type === "story_approved" && (
              <>
                {t.notifications.storyApproved} {storyTitle && <>«{storyTitle}»</>}
              </>
            )}
            {n.type === "story_rejected" && (
              <>
                {t.notifications.storyRejected} {storyTitle && <>«{storyTitle}»</>}
                {n.message && <span className="block text-[13px] text-muted-2">{n.message}</span>}
              </>
            )}
            {n.type === "story_hidden" && (
              <>
                {t.notifications.storyHidden} {storyTitle && <>«{storyTitle}»</>}
                {n.message && <span className="block text-[13px] text-muted-2">{n.message}</span>}
              </>
            )}
            {n.type === "chapter_approved" && (
              <>
                {t.notifications.chapterApproved} {chapterTitle && <>«{chapterTitle}»</>}
              </>
            )}
            {n.type === "chapter_rejected" && (
              <>
                {t.notifications.chapterRejected} {chapterTitle && <>«{chapterTitle}»</>}
                {n.message && <span className="block text-[13px] text-muted-2">{n.message}</span>}
              </>
            )}
          </p>
          <span className="mt-1.5 block text-[12.5px] text-muted-3">
            {new Date(n.created_at).toLocaleString(locale)}
          </span>
        </div>
      </Link>

      {!isRead && (
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="h-2 w-2 rounded-full bg-danger" />
          <button
            type="button"
            onClick={handleMarkRead}
            className="cursor-pointer whitespace-nowrap text-[12px] font-bold text-primary-800"
          >
            {t.notifications.markRead}
          </button>
        </div>
      )}
    </div>
  );
}
