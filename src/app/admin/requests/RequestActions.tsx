"use client";

import { useTransition } from "react";
import { setRequestStatusAdmin, deleteRequestAdmin } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function RequestActions({ requestId, status }: { requestId: string; status: string }) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  const isClosed = status === "closed";

  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => setRequestStatusAdmin(requestId, isClosed ? "open" : "closed"))}
        className="h-8.5 cursor-pointer rounded-[9px] border border-primary-300 bg-white px-3 text-[12.5px] font-bold text-primary-900 disabled:opacity-50"
      >
        {isClosed ? t.admin.openRequest : t.admin.closeRequest}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => deleteRequestAdmin(requestId))}
        className="flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-[9px] border border-red-200 bg-white text-danger disabled:opacity-50"
      >
        ×
      </button>
    </div>
  );
}
