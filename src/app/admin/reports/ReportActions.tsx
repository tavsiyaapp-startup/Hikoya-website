"use client";

import { useTransition } from "react";
import { resolveReport, deleteReport } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function ReportActions({ reportId }: { reportId: string }) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => resolveReport(reportId, "resolved"))}
        className="h-8.5 cursor-pointer rounded-[9px] border border-primary-300 bg-card px-3 text-[12.5px] font-bold text-primary-900 disabled:opacity-50"
      >
        {t.admin.check}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => deleteReport(reportId))}
        className="flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-[9px] border border-red-200 dark:border-red-900/60 bg-card text-danger disabled:opacity-50"
      >
        ×
      </button>
    </div>
  );
}
