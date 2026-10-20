"use client";

import { useState } from "react";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// "Online" = a page viewed in the last 5 minutes (profiles.last_seen_at is
// written at most once a minute, see src/lib/current-user.ts).
const ONLINE_MS = 5 * 60 * 1000;

export function LastSeen({ lastSeenAt }: { lastSeenAt: string | null }) {
  const { t, locale } = useLocale();
  // Read once when the row appears (not on every re-render).
  const [now] = useState(() => Date.now());
  if (!lastSeenAt) return <span className="text-[12px] text-muted-3">{t.admin.lastSeenNever}</span>;

  const online = now - new Date(lastSeenAt).getTime() < ONLINE_MS;
  if (online) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-success">
        <span className="h-2 w-2 rounded-full bg-success" />
        {t.admin.online}
      </span>
    );
  }
  return (
    <span className="text-[12px] text-muted-2" title={formatDateTime(lastSeenAt, locale)}>
      {t.admin.lastSeen} {formatRelativeTime(lastSeenAt, locale)}
    </span>
  );
}
