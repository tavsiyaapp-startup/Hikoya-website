import type { AdminActivityItem } from "@/lib/queries/admin";
import type { Dictionary } from "@/lib/i18n";
import { formatRelativeTime, formatDateTime } from "@/lib/format";
import { LibraryIcon, MessageIcon, UserIcon } from "@/components/ui/icons";

// Shared by the dashboard's short "recent activity" card and the full
// /admin/activity page — same three event types, just a different row count
// and (full ? absolute : relative) timestamp.
export function ActivityIcon({ type }: { type: AdminActivityItem["type"] }) {
  const base = "flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]";
  if (type === "story_published") {
    return (
      <span className={`${base} bg-primary-100 text-primary-700`}>
        <LibraryIcon width={16} height={16} />
      </span>
    );
  }
  if (type === "new_comment") {
    return (
      <span className={`${base} bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300`}>
        <MessageIcon width={16} height={16} />
      </span>
    );
  }
  return (
    <span className={`${base} bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300`}>
      <UserIcon width={16} height={16} />
    </span>
  );
}

export function activityText(item: AdminActivityItem, t: Dictionary) {
  switch (item.type) {
    case "story_published":
      return (
        <>
          {item.actorName} {t.admin.activityPublishedStory} «{item.targetTitle}»
        </>
      );
    case "new_comment":
      return (
        <>
          {item.actorName} {t.admin.activityNewComment} «{item.targetTitle}»
        </>
      );
    case "new_user":
      return (
        <>
          {item.actorName} {t.admin.activityNewUser}
        </>
      );
  }
}

export function ActivityRow({
  item,
  locale,
  t,
  full,
}: {
  item: AdminActivityItem;
  locale: string;
  t: Dictionary;
  full?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border-soft pb-3 last:border-0">
      <ActivityIcon type={item.type} />
      <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink-soft">{activityText(item, t)}</p>
      <span className="shrink-0 text-[12px] text-muted-3">
        {full ? formatDateTime(item.timestamp, locale) : formatRelativeTime(item.timestamp, locale)}
      </span>
    </div>
  );
}
