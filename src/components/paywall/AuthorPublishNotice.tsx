"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { PaywallOffer } from "@/lib/paywall-offer";
import { Button } from "@/components/ui/Button";
import { LockIcon } from "@/components/ui/icons";
import { SubscribeDialog } from "./SubscribeDialog";

// For authors while «Obuna» is on: either "publishing new chapters now needs a
// subscription" (with the subscribe popup), or how many free chapters a new
// author still has. Rendered by the manage and create pages.

export function AuthorPublishNotice({
  allowed,
  freeLeft,
  offer,
  nextPath,
}: {
  allowed: boolean;
  freeLeft: number | null;
  offer: PaywallOffer;
  nextPath: string;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  if (allowed) {
    if (freeLeft === null) return null;
    return (
      <p className="mb-4 rounded-[14px] bg-primary-50 px-4 py-3 text-[13.5px] font-semibold text-primary-900">
        {t.paywall.authorFreeLeft.replace("{n}", String(freeLeft))}
      </p>
    );
  }

  return (
    <div id="publish-subscription" className="mb-5 flex flex-col gap-4 rounded-[18px] border border-primary-200 bg-primary-50 p-5 sm:flex-row sm:items-center">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-card text-primary-700">
        <LockIcon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[15.5px] font-bold text-primary-950">{t.paywall.authorGateTitle}</div>
        <p className="text-[13.5px] leading-relaxed text-ink-soft">{t.paywall.authorGateBody}</p>
      </div>
      <Button className="shrink-0" onClick={() => setOpen(true)}>
        {t.paywall.subscribeButton}
      </Button>
      {open && <SubscribeDialog offer={offer} signedIn nextPath={nextPath} onClose={() => setOpen(false)} />}
    </div>
  );
}
