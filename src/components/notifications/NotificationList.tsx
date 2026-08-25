import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import { ROUTES } from "@/lib/constants";
import { HeartIcon, MessageIcon, ShieldIcon } from "@/components/ui/icons";
import type { NotificationWithContext } from "@/lib/queries/notifications";

function notificationHref(n: NotificationWithContext): string {
  if (!n.story) return ROUTES.home;
  if (n.type === "story_rejected" || n.type === "chapter_rejected") return ROUTES.manage(n.story.slug);
  if (!n.chapter) return ROUTES.story(n.story.slug);
  const base = ROUTES.chapter(n.story.slug, n.chapter.order_index);
  return n.comment_id ? `${base}#comment-${n.comment_id}` : base;
}

function NotificationIcon({ type }: { type: NotificationWithContext["type"] }) {
  if (type === "comment_like") return <HeartIcon filled className="text-primary-600" />;
  if (type === "new_comment" || type === "comment_reply") return <MessageIcon className="text-primary-600" />;
  return <ShieldIcon className="text-primary-600" width={16} height={16} />;
}

export async function NotificationList({
  notifications,
  locale,
}: {
  notifications: NotificationWithContext[];
  locale: "ru" | "uz";
}) {
  const t = getDictionary(locale);

  if (notifications.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-soft bg-surface px-6 py-14 text-center text-[14px] text-muted">
        {t.notifications.empty}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {notifications.map((n) => {
        const actorName = n.actor?.display_name;
        const chapterTitle = n.chapter?.title;
        const storyTitle = n.story?.title;

        return (
          <Link
            key={n.id}
            href={notificationHref(n)}
            className={`flex gap-3.5 rounded-2xl border p-4.5 transition ${
              n.is_read ? "border-border bg-card" : "border-primary-200 bg-primary-50"
            }`}
          >
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
            {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-danger" />}
          </Link>
        );
      })}
    </div>
  );
}
