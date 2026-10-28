"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import { grantSubscriptionToUser } from "@/lib/actions/paywall";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

// Opens an «Obuna» subscription for one user straight from the users list,
// without the Telegram bot flow (for payment taken off-platform). Confirms
// first — it hands out paid access — and shows the new expiry on success.
// Only rendered for admins (money is admin-only, mirrored server-side).
export function SubscriptionGrantButton({
  userId,
  userName,
  locale,
  className,
}: {
  userId: string;
  userName: string;
  locale: Locale;
  className?: string;
}) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t.admin.grantSubscriptionConfirm.replace("{name}", userName))) return;
        startTransition(async () => {
          const res = await grantSubscriptionToUser(userId);
          if (!res.ok) window.alert(t.admin.actionRefused);
          else window.alert(t.admin.grantSubscriptionDone.replace("{date}", formatDate(res.until, locale)));
        });
      }}
      className={clsx(
        "h-8.5 cursor-pointer rounded-[9px] border border-primary-200 bg-primary-50 px-3 text-[12.5px] font-bold text-primary-800 disabled:opacity-50",
        className
      )}
    >
      {t.admin.grantSubscription}
    </button>
  );
}
