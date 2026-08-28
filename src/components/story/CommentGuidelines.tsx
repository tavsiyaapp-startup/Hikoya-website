"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";
import { ShieldIcon, SendIcon, CloseIcon } from "@/components/ui/icons";

const TELEGRAM_SUPPORT_URL = `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}`;

// Shown once above the top-level comment form (not repeated per reply) —
// dismiss is session-only (component state, no localStorage), it just
// clears the clutter while the reader is actively writing.
export function CommentGuidelines() {
  const { t } = useLocale();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative mb-4 rounded-2xl border border-primary-200 bg-primary-50 p-4 pr-10">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t.common.close}
        className="absolute right-2.5 top-2.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-primary-800 transition hover:bg-primary-100"
      >
        <CloseIcon width={15} height={15} />
      </button>
      <p className="mb-2 flex items-start gap-2 text-[13px] leading-relaxed text-primary-900">
        <ShieldIcon width={16} height={16} className="mt-0.5 shrink-0" />
        <span>
          {t.reader.commentRulesWarning}{" "}
          <Link href={ROUTES.rules} className="font-bold underline">
            {t.reader.commentRulesLink} »
          </Link>
        </span>
      </p>
      <p className="flex items-start gap-2 text-[13px] leading-relaxed text-primary-900">
        <SendIcon width={16} height={16} className="mt-0.5 shrink-0" />
        <span>
          {t.reader.commentErrorNotice}{" "}
          <a
            href={TELEGRAM_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline"
          >
            {t.reader.commentErrorLink} »
          </a>
        </span>
      </p>
    </div>
  );
}
