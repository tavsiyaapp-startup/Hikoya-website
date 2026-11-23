"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { SubscribeDialog } from "@/components/paywall/SubscribeDialog";
import type { PaywallOffer } from "@/lib/paywall-offer";

// Shown when the viewer's subscription expires within a few days (the layout
// decides when). Tells them the exact date and offers to renew. Shown at most
// once per day per expiry (localStorage), so it reminds without nagging on
// every page; renewing changes expiresAt, so it reappears near the new date.

const SEEN_KEY = "hikoya:sub-expiry-seen";

export function SubscriptionExpiringPopup({ expiresAt, offer }: { expiresAt: string; offer: PaywallOffer }) {
  const { t, locale } = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [renew, setRenew] = useState(false);

  useEffect(() => {
    try {
      const token = `${expiresAt}|${new Date().toISOString().slice(0, 10)}`;
      if (localStorage.getItem(SEEN_KEY) === token) return; // already shown today
      localStorage.setItem(SEEN_KEY, token);
    } catch {
      // private mode / blocked storage — just show it
    }
    // One-time, mount-only decision synced from localStorage (external system),
    // so SSR renders nothing and it only appears after hydration — no mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [expiresAt]);

  if (!open && !renew) return null;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal
            aria-labelledby="sub-expiry-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-110 rounded-[18px] border border-border bg-card p-6 shadow-[0_30px_80px_rgba(30,20,60,0.25)] sm:p-7"
          >
            <h2 id="sub-expiry-title" className="mb-3 text-[13px] font-bold uppercase tracking-wide text-primary-800">
              {t.paywall.expiringTitle}
            </h2>
            <p className="mb-5 text-[15px] leading-relaxed text-ink">
              {t.paywall.expiringBody.replace("{date}", formatDate(expiresAt, locale))}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {t.common.close}
              </Button>
              <Button
                onClick={() => {
                  setOpen(false);
                  setRenew(true);
                }}
              >
                {t.paywall.expiringRenew}
              </Button>
            </div>
          </div>
        </div>
      )}
      {renew && <SubscribeDialog offer={offer} signedIn nextPath={pathname} onClose={() => setRenew(false)} />}
    </>
  );
}
