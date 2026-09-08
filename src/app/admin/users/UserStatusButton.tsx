"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import { toggleUserStatus } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function UserStatusButton({ userId, status, className }: { userId: string; status: string; className?: string }) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleUserStatus(userId, status))}
      className={clsx(
        "h-8.5 cursor-pointer rounded-[9px] border border-border bg-card px-3.5 text-[12.5px] font-bold text-ink-soft disabled:opacity-50",
        className
      )}
    >
      {status === "active" ? t.admin.block : t.admin.unblock}
    </button>
  );
}
