"use client";

import { useEffect, useState, useTransition } from "react";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { CARD_TYPE_LABEL, formatCardNumber, type CardType } from "@/lib/card";
import { reportDonation } from "@/lib/actions/donations";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CloseIcon, EyeIcon, HeartIcon } from "@/components/ui/icons";

// «Donat yuborish» on an author page: opens a popup with the author's
// message and card number; tapping the number copies it, and the reader
// sends the transfer from their own bank app (Hikoya never handles money).

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / non-secure contexts: the textarea fallback.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

type Copyable = "local" | "intl" | "holder";

export function DonateButton({
  authorId,
  authorName,
  avatarUrl,
  local,
  intl,
  cardHolder,
  message,
}: {
  authorId: string;
  authorName: string;
  avatarUrl: string | null;
  local: { number: string; type: CardType } | null;
  intl: { number: string; type: CardType } | null;
  cardHolder: string | null;
  message: string | null;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<Copyable | null>(null);
  const cards = [
    local && { key: "local" as const, label: t.donation.localCardFor, ...local },
    intl && { key: "intl" as const, label: t.donation.intlCardFor, ...intl },
  ].filter((c) => c !== null);
  // With both cards, «Oʻzbekistondan» / «Xorijdan» tabs show one at a time.
  const [tab, setTab] = useState(0);
  const [tabFrom, setTabFrom] = useState(0);
  // Card numbers stay blurred until tapped; the next tap copies.
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const card = cards[Math.min(tab, cards.length - 1)];

  // «Qancha donat qilmoqchisiz?» — reported to the team's Telegram chat.
  const [amount, setAmount] = useState("");
  const [report, setReport] = useState<"sent" | "amount" | "rate" | "failed" | null>(null);
  const [sending, startSending] = useTransition();

  function sendReport() {
    if (!card) return;
    startSending(async () => {
      const res = await reportDonation(authorId, card.key, amount);
      setReport(res.ok ? "sent" : (res.error ?? "failed"));
    });
  }

  function openPopup() {
    setAmount("");
    setReport(null);
    setRevealed({});
    setTab(0);
    setTabFrom(0);
    setOpen(true);
  }

  function pickTab(i: number) {
    if (i === tab) return;
    setTabFrom(i > tab ? 28 : -28);
    setTab(i);
  }

  function tapCard(key: "local" | "intl", number: string) {
    if (!revealed[key]) {
      setRevealed((r) => ({ ...r, [key]: true }));
      return;
    }
    copy(key, number);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(null), 2200);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy(what: Copyable, text: string) {
    if (await copyText(text)) setCopied(what);
  }

  return (
    <>
      <button
        type="button"
        onClick={openPopup}
        className="flex h-10.5 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent text-[14px] font-bold text-on-accent shadow-[0_10px_24px_-12px_rgba(85,53,166,0.6)] transition hover:-translate-y-px hover:bg-accent-hover"
      >
        <HeartIcon filled width={16} height={16} className="shrink-0" />
        {t.donation.button}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-label={t.donation.title}>
          <button type="button" aria-label={t.common.close} onClick={() => setOpen(false)} className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[2px]" />
          <div
            className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[26px] bg-card p-6 sm:rounded-[26px]"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.common.close}
              className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full hover:bg-surface"
            >
              <CloseIcon />
            </button>

            <div className="mb-5 flex items-center gap-3.5 pr-10">
              <Avatar name={authorName} src={avatarUrl} size={48} />
              <div className="min-w-0">
                <h2 className="text-[19px] font-bold leading-tight">{t.donation.title}</h2>
                <div className="truncate text-[13.5px] text-muted-2">{authorName}</div>
              </div>
            </div>

            <blockquote className="mb-5 whitespace-pre-line rounded-[16px] border border-primary-100 bg-primary-50/60 px-4.5 py-3.5 font-display text-[15.5px] leading-relaxed text-ink">
              {message || t.donation.defaultMessage}
            </blockquote>

            {cards.length > 1 && (
              <div role="tablist" className="relative mb-4 grid grid-cols-2 rounded-full bg-surface p-1">
                <span
                  aria-hidden
                  className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-card shadow-[0_4px_14px_-6px_rgba(45,31,85,0.35)] transition-transform duration-300 ease-[var(--ease-premium)]"
                  style={{ transform: `translateX(${tab * 100}%)` }}
                />
                {cards.map((c, i) => (
                  <button
                    key={c.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === i}
                    onClick={() => pickTab(i)}
                    className={clsx(
                      "relative z-10 h-9.5 cursor-pointer rounded-full text-[13.5px] font-bold transition-colors",
                      tab === i ? "text-ink" : "text-muted-2 hover:text-ink-soft"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {card && (
              <div key={card.key} role="tabpanel" className="tab-in mb-4" style={{ "--tab-from": `${tabFrom}px` } as React.CSSProperties}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[12.5px] font-bold text-muted-2">
                  <span>{cards.length > 1 ? t.donation.cardLabel : card.label}</span>
                  <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11.5px] tracking-wide">{CARD_TYPE_LABEL[card.type]}</span>
                </div>
                <button
                  type="button"
                  onClick={() => tapCard(card.key, card.number)}
                  aria-label={revealed[card.key] ? undefined : t.donation.tapToReveal}
                  className={clsx(
                    "group mb-1.5 flex w-full cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-[16px] border px-4.5 py-4 text-left transition",
                    copied === card.key ? "border-primary-300 bg-primary-50" : "border-border bg-surface hover:border-primary-200"
                  )}
                >
                  <span
                    aria-hidden={!revealed[card.key]}
                    className={clsx(
                      "font-mono text-[19px] font-semibold tracking-[0.06em] tabular-nums transition-[filter,opacity] duration-500 sm:text-[21px]",
                      revealed[card.key] ? "blur-0" : "select-none opacity-70 blur-[7px]"
                    )}
                  >
                    {formatCardNumber(card.number)}
                  </span>
                  {revealed[card.key] ? <CopyIcon done={copied === card.key} /> : <EyeIcon width={20} height={20} className="shrink-0 text-muted-2 group-hover:text-primary-700" />}
                </button>
                <p aria-live="polite" className={clsx("text-[12.5px]", copied === card.key ? "font-bold text-primary-800" : "text-muted-2")}>
                  {copied === card.key ? t.donation.copied : revealed[card.key] ? t.donation.tapToCopy : t.donation.tapToReveal}
                </p>
              </div>
            )}

            {cardHolder && (
              <>
                <div className="mb-1.5 text-[12.5px] font-bold text-muted-2">{t.donation.holderLabel}</div>
                <button
                  type="button"
                  onClick={() => copy("holder", cardHolder)}
                  className={clsx(
                    "group mb-4 flex w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] border px-4.5 py-3 text-left transition",
                    copied === "holder" ? "border-primary-300 bg-primary-50" : "border-border bg-surface hover:border-primary-200"
                  )}
                >
                  <span className="text-[15px] font-semibold uppercase tracking-wide">{cardHolder}</span>
                  <CopyIcon done={copied === "holder"} />
                </button>
              </>
            )}

            <div className="mb-4 rounded-[16px] border border-border p-4">
              <label htmlFor="donation-amount" className="mb-1.5 block text-[13px] font-bold">
                {t.donation.amountLabel}
              </label>
              {report === "sent" ? (
                <p className="text-[13.5px] font-bold text-primary-800">{t.donation.amountSent}</p>
              ) : (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendReport();
                  }}
                >
                  <Input
                    id="donation-amount"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value.slice(0, 40));
                      setReport(null);
                    }}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={card?.key === "intl" ? t.donation.amountPlaceholderIntl : t.donation.amountPlaceholder}
                    className="min-w-0 flex-1"
                  />
                  <Button type="submit" className="!h-auto shrink-0 self-stretch" disabled={sending || !/\d/.test(amount)}>
                    {sending ? t.common.loading : t.donation.amountSend}
                  </Button>
                </form>
              )}
              {report && report !== "sent" && (
                <p className="mt-1.5 text-[12.5px] text-danger">
                  {report === "amount" ? t.donation.amountInvalid : report === "rate" ? t.donation.errorRate : t.common.error}
                </p>
              )}
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted-2">{t.donation.amountNote}</p>
            </div>

            <p className="text-[12px] leading-relaxed text-muted-2">{t.donation.note}</p>
          </div>
        </div>
      )}
    </>
  );
}

function CopyIcon({ done }: { done: boolean }) {
  return done ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-primary-700" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-2 transition group-hover:text-primary-700" aria-hidden>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
    </svg>
  );
}
