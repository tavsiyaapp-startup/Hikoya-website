"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { startPaymentClaim } from "@/lib/actions/paywall";
import { CARD_TYPE_LABEL, formatCardNumber, type CardType } from "@/lib/card";
import { copyText } from "@/lib/copy-text";
import type { PaywallOffer } from "@/lib/paywall-offer";
import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { CloseIcon, LockIcon } from "@/components/ui/icons";

// «Obuna» popup: why to subscribe, the price, the card to pay to, and the
// «Toʻladim» button that opens the Telegram bot with a link tied to this
// account (src/lib/actions/paywall.ts → src/app/api/telegram/support/route.ts).
// A guest is asked to sign in first — the subscription belongs to an account.

export function SubscribeDialog({
  offer,
  signedIn,
  nextPath,
  intro,
  onClose,
}: {
  offer: PaywallOffer;
  signedIn: boolean;
  nextPath: string;
  // A line above the message (e.g. "free quote cards are used up").
  intro?: string | null;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const [botUrl, setBotUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(id);
  }, [copied]);

  function paid() {
    setError(null);
    startTransition(async () => {
      const res = await startPaymentClaim();
      if ("url" in res) {
        setBotUrl(res.url);
        window.location.href = res.url;
        return;
      }
      setError(res.error === "nobot" ? t.paywall.errorNoBot : res.error === "rate" ? t.paywall.errorRate : t.common.error);
    });
  }

  const cardType = offer.cardType && offer.cardType in CARD_TYPE_LABEL ? CARD_TYPE_LABEL[offer.cardType as CardType] : null;
  const signupHref = `${ROUTES.onboarding}?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-label={t.paywall.dialogTitle}>
      <button type="button" aria-label={t.common.close} onClick={onClose} className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[2px]" />
      <div
        className="relative max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-[26px] bg-card p-6 sm:rounded-[26px]"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full hover:bg-surface"
        >
          <CloseIcon />
        </button>

        <div className="mb-4 flex items-center gap-3 pr-10">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-primary-50 text-primary-700">
            <LockIcon className="h-5 w-5" />
          </span>
          <h2 className="text-[20px] font-bold leading-tight">{t.paywall.dialogTitle}</h2>
        </div>

        {intro && <p className="mb-3 text-[13.5px] font-semibold text-primary-800">{intro}</p>}

        <p className="mb-4 whitespace-pre-line font-display text-[15.5px] leading-relaxed text-ink">
          {offer.message || t.paywall.defaultMessage}
        </p>

        <div className="mb-5 rounded-[16px] bg-linear-to-br from-primary-50 to-card px-4.5 py-3.5 ring-1 ring-primary-100">
          <div className="font-display text-[22px] font-bold text-primary-900">
            {t.paywall.priceLine.replace("{price}", offer.price).replace("{days}", String(offer.periodDays))}
          </div>
          <div className="text-[13px] text-muted">{t.paywall.allStories}</div>
        </div>

        {!signedIn ? (
          <div className="mb-2">
            <p className="mb-3.5 text-[14px] leading-relaxed text-ink-soft">{t.paywall.signupFirst}</p>
            <Link prefetch={false} href={signupHref} className="block">
              <Button className="w-full justify-center">{t.paywall.signupButton}</Button>
            </Link>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            <Step n={1} text={t.paywall.step1}>
              {offer.cardNumber && (
                <>
                  <button
                    type="button"
                    onClick={async () => setCopied(await copyText(offer.cardNumber ?? ""))}
                    className={clsx(
                      "mt-2 flex w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] border px-4 py-3 text-left transition",
                      copied ? "border-primary-300 bg-primary-50" : "border-border bg-surface hover:border-primary-200"
                    )}
                  >
                    <span className="font-mono text-[17px] font-semibold tracking-[0.05em] tabular-nums">{formatCardNumber(offer.cardNumber)}</span>
                    {cardType && <span className="text-[11.5px] font-bold text-muted-2">{cardType}</span>}
                  </button>
                  <div className="mt-1 flex justify-between gap-2 text-[12px]">
                    <span className="truncate uppercase text-muted-2">{offer.cardHolder}</span>
                    <span aria-live="polite" className={copied ? "font-bold text-primary-800" : "text-muted-2"}>
                      {copied ? t.donation.copied : t.donation.tapToCopy}
                    </span>
                  </div>
                </>
              )}
            </Step>
            <Step n={2} text={t.paywall.step2} />
            <Step n={3} text={t.paywall.step3} />
          </ol>
        )}

        {signedIn && (
          <div className="mt-5">
            <Button className="w-full justify-center" size="lg" disabled={pending} onClick={paid}>
              {pending ? t.paywall.opening : `✓ ${t.paywall.paidButton}`}
            </Button>
            {botUrl && (
              <a href={botUrl} className="mt-2 block text-center text-[13px] font-bold text-primary-800 underline">
                {t.paywall.openFallback}
              </a>
            )}
            {error && <p className="mt-2 text-center text-[13px] text-danger">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Step({ n, text, children }: { n: number; text: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-card">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="text-[14px] leading-snug text-ink-soft">{text}</div>
        {children}
      </div>
    </li>
  );
}
