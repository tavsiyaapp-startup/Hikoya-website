"use client";

import { useTransition } from "react";
import { closeRequest } from "@/lib/actions/requests";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function CloseRequestButton({ requestId }: { requestId: string }) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => closeRequest(requestId))}
      className="ml-auto cursor-pointer text-[12.5px] font-bold text-danger disabled:opacity-50"
    >
      {pending ? t.common.loading : t.board.closeRequest}
    </button>
  );
}
