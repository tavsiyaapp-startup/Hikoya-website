"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { PaywallOffer } from "@/lib/paywall-offer";
import { Button } from "@/components/ui/Button";
import { LockIcon } from "@/components/ui/icons";
import { SubscribeDialog } from "./SubscribeDialog";

// In place of a chapter's text when it needs a subscription (the server sends
// no text at all). The popup opens by itself; closing it leaves this card
// with a button to open it again.

export function SubscribeGate({
  offer,
  signedIn,
  nextPath,
  orderIndex,
  freeChapters,
}: {
  offer: PaywallOffer;
  signedIn: boolean;
  nextPath: string;
  orderIndex: number;
  freeChapters: number;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(true);

  return (
    <>
      <div className="rounded-[20px] bg-linear-to-br from-ink-dark to-primary-950 px-5 py-6 text-white sm:px-9 sm:py-8.5">
        <div className="mb-3.5 flex items-center gap-3">
          <LockIcon className="h-5.5 w-5.5 text-primary-300" />
          <span className="text-[13px] font-bold uppercase tracking-wide text-primary-300">
            {t.reader.chapterLabel} {orderIndex} · {t.paywall.badge}
          </span>
        </div>
        <h3 className="mb-2.5 text-[26px] font-extrabold tracking-tight">{t.paywall.lockedTitle}</h3>
        <p className="mb-6 max-w-130 text-[15px] leading-relaxed text-primary-200">
          {t.paywall.lockedBody.replace("{n}", String(freeChapters))}
        </p>
        <Button onClick={() => setOpen(true)} style={{ background: "#fff", color: "#3B2568" }} className="border-none">
          {t.paywall.subscribeButton}
        </Button>
      </div>
      {open && <SubscribeDialog offer={offer} signedIn={signedIn} nextPath={nextPath} onClose={() => setOpen(false)} />}
    </>
  );
}
