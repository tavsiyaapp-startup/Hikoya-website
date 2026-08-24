"use client";

import { useTransition } from "react";
import { resolveReport, deleteReport } from "@/lib/actions/admin";

export function ReportActions({ reportId }: { reportId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => resolveReport(reportId, "resolved"))}
        className="h-8.5 cursor-pointer rounded-[9px] border border-primary-300 bg-white px-3 text-[12.5px] font-bold text-primary-900 disabled:opacity-50"
      >
        Проверить
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => deleteReport(reportId))}
        className="flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-[9px] border border-red-200 bg-white text-danger disabled:opacity-50"
      >
        ×
      </button>
    </div>
  );
}
