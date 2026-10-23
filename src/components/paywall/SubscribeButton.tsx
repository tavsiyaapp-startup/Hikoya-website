"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { PaywallOffer } from "@/lib/paywall-offer";
import { SubscribeDialog } from "./SubscribeDialog";

// "Obuna boʻlish" on the reader's own profile (while «Obuna» is on and they
// have no active subscription) — opens the same popup as a locked chapter.
export function SubscribeButton({ offer, nextPath }: { offer: PaywallOffer; nextPath: string }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10.5 w-full cursor-pointer items-center justify-center rounded-xl border border-primary-200 bg-primary-50 text-[14px] font-bold text-primary-900 transition hover:border-primary-300"
      >
        {t.paywall.subscribeButton}
      </button>
      {open && <SubscribeDialog offer={offer} signedIn nextPath={nextPath} onClose={() => setOpen(false)} />}
    </>
  );
}
