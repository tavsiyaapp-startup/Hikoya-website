import { getDictionary } from "@/lib/i18n";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import type { NotificationWithContext } from "@/lib/queries/notifications";

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
      {notifications.map((n) => (
        <NotificationItem key={n.id} notification={n} locale={locale} />
      ))}
    </div>
  );
}
