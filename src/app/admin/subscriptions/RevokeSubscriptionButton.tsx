"use client";

import { useState, useTransition } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { revokeSubscriptionAction } from "@/lib/actions/paywall";

export function RevokeSubscriptionButton({ userId }: { userId: string }) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t.paywall.adminRevokeConfirm)) return;
        setFailed(false);
        startTransition(async () => {
          if (!(await revokeSubscriptionAction(userId))) setFailed(true);
        });
      }}
      className="cursor-pointer text-[12.5px] font-bold text-danger disabled:opacity-50"
    >
      {failed ? t.common.error : t.paywall.adminRevoke}
    </button>
  );
}
