"use client";

import { useState, useTransition } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { saveDonationSettings } from "@/lib/actions/donations";
import { cardBrand, formatCardNumber } from "@/lib/card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

// «Donatlar» block in the profile settings (EditProfileForm). The author
// page only renders it for an author with a published story; filling in a
// card number turns the «Donat yuborish» button on, clearing it turns it off.

const MESSAGE_MAX = 300;

export function DonationSettings({
  username,
  cardNumber,
  cardHolder,
  message,
}: {
  username: string;
  cardNumber: string | null;
  cardHolder: string | null;
  message: string | null;
}) {
  const { t } = useLocale();
  const [card, setCard] = useState(formatCardNumber(cardNumber ?? ""));
  const [text, setText] = useState(message ?? "");
  const [enabled, setEnabled] = useState(Boolean(cardNumber));
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const brand = cardBrand(card.replace(/\D/g, ""));

  function submit(formData: FormData) {
    setStatus(null);
    startTransition(async () => {
      const res = await saveDonationSettings(username, formData);
      if (res.ok) {
        setEnabled(res.enabled);
        setStatus({ ok: true, text: res.enabled ? t.donation.saved : t.donation.turnedOff });
        return;
      }
      const errors = {
        card: t.donation.errorCard,
        holder: t.donation.errorHolder,
        message: t.donation.errorMessage,
        rate: t.donation.errorRate,
        forbidden: t.common.error,
        failed: t.common.error,
      } as const;
      setStatus({ ok: false, text: errors[res.error] });
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-bold">{t.donation.settingsTitle}</div>
          <p className="mt-0.5 text-[12px] text-muted-2">{t.donation.settingsHint}</p>
        </div>
        <span
          className={
            enabled
              ? "shrink-0 rounded-full bg-primary-50 px-2.5 py-1 text-[11.5px] font-bold text-primary-800"
              : "shrink-0 rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-bold text-muted-2"
          }
        >
          {enabled ? t.donation.on : t.donation.off}
        </span>
      </div>

      <div>
        <label className="mb-1.5 flex items-center justify-between text-[13px] font-bold">
          {t.donation.cardLabel}
          {brand && <span className="text-[11.5px] font-semibold text-muted-2">{brand}</span>}
        </label>
        <Input
          name="cardNumber"
          value={card}
          onChange={(e) => setCard(formatCardNumber(e.target.value).slice(0, 19))}
          inputMode="numeric"
          autoComplete="off"
          placeholder="8600 0000 0000 0000"
          className="font-mono tracking-wide"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-bold">
          {t.donation.holderSettingsLabel} <span className="font-medium text-muted-2">{t.common.optional}</span>
        </label>
        <Input name="cardHolder" defaultValue={cardHolder ?? ""} maxLength={60} autoComplete="off" placeholder={t.donation.holderPlaceholder} />
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-bold">
          {t.donation.messageLabel} <span className="font-medium text-muted-2">{t.common.optional}</span>
        </label>
        <Textarea
          name="message"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MESSAGE_MAX))}
          placeholder={t.donation.defaultMessage}
          rows={3}
        />
        <p className="mt-1 text-right text-[11.5px] text-muted-2 tabular-nums">
          {text.length}/{MESSAGE_MAX}
        </p>
      </div>

      {status && <p className={status.ok ? "text-[12.5px] font-bold text-primary-800" : "text-[12.5px] text-danger"}>{status.text}</p>}

      <div>
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? t.common.loading : t.common.save}
        </Button>
      </div>
    </form>
  );
}
