"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";

// Shown instead of the comment form for a blocked account. The block is
// enforced on the server too (see src/server/authz/policy.ts); this only
// explains it. The support chat stays open, so the user can contact admin.
export function CommentBlockedNotice() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-2 rounded-[13px] border border-border bg-surface px-4 py-3 text-[14px] text-ink-soft">
      <p>{t.reader.commentsBlocked}</p>
      <Link href={ROUTES.chat} className="font-semibold text-primary-700 hover:underline">
        {t.reader.contactAdmin}
      </Link>
    </div>
  );
}
