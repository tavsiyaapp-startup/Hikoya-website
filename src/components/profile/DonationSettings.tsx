"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { saveDonationSettings } from "@/lib/actions/donations";
import {
  CARD_TYPE_LABEL,
  INTL_CARD_TYPES,
  LOCAL_CARD_TYPES,
  formatCardNumber,
  guessCardType,
  type CardType,
} from "@/lib/card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

// «Donatlar» block in the profile settings (EditProfileForm). The author
// page only renders it for an author with a published story. Two optional
// cards — local (Uzcard / Humo) and international (Visa / Mastercard);
// filling in either turns the «Donat yuborish» button on, clearing both
// turns it off.

const MESSAGE_MAX = 300;

function CardField<T extends CardType>({
  title,
  hint,
  name,
  typeName,
  types,
  initialNumber,
  initialType,
  placeholder,
  auto = false,
}: {
  title: string;
  hint: string;
  name: string;
  typeName: string;
  types: readonly T[];
  initialNumber: string | null;
  initialType: T | null;
  placeholder: string;
  // Type comes from the number's first digits (Uzcard 8600…, Humo 9860…);
  // no buttons to pick it.
  auto?: boolean;
}) {
  const { t } = useLocale();
  const [number, setNumber] = useState(formatCardNumber(initialNumber ?? ""));
  const [type, setType] = useState<T | null>(initialType);
  // Once the author picks a type by hand, typing no longer changes it.
  const [picked, setPicked] = useState(Boolean(initialType));

  function onNumber(raw: string) {
    const formatted = formatCardNumber(raw).slice(0, 19);
    setNumber(formatted);
    if (auto || !picked) {
      const guess = guessCardType(formatted.replace(/\D/g, ""));
      setType(types.find((x) => x === guess) ?? null);
    }
  }

  return (
    <div className="rounded-[14px] border border-border-soft bg-surface/50 p-3.5">
      <div className="mb-0.5 text-[13px] font-bold">
        {title} <span className="font-medium text-muted-2">{t.common.optional}</span>
      </div>
      <p className="mb-2.5 text-[12px] text-muted-2">{hint}</p>
      <input type="hidden" name={typeName} value={type ?? ""} />
      {!auto && (
      <div className="mb-2.5 flex flex-wrap gap-2" role="radiogroup" aria-label={t.donation.cardTypeLabel}>
        {types.map((x) => (
          <button
            key={x}
            type="button"
            role="radio"
            aria-checked={type === x}
            onClick={() => {
              setType(x);
              setPicked(true);
            }}
            className={clsx(
              "h-8.5 cursor-pointer rounded-full border px-3.5 text-[13px] font-semibold transition",
              type === x ? "border-ink bg-ink text-card" : "border-border bg-card text-ink-soft hover:border-primary-200"
            )}
          >
            {CARD_TYPE_LABEL[x]}
          </button>
        ))}
      </div>
      )}
      <Input
        name={name}
        value={number}
        onChange={(e) => onNumber(e.target.value)}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        aria-label={`${title}: ${t.donation.cardLabel}`}
        className="font-mono tracking-wide"
      />
      {auto && type && <p className="mt-1.5 text-[12px] font-bold text-primary-800">{CARD_TYPE_LABEL[type]}</p>}
    </div>
  );
}

export function DonationSettings({
  username,
  local,
  intl,
  cardHolder,
  message,
}: {
  username: string;
  local: { number: string; type: "uzcard" | "humo" } | null;
  intl: { number: string; type: "visa" | "mastercard" } | null;
  cardHolder: string | null;
  message: string | null;
}) {
  const { t } = useLocale();
  const [text, setText] = useState(message ?? "");
  const [enabled, setEnabled] = useState(Boolean(local || intl));
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

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
        intlCard: t.donation.errorIntlCard,
        cardType: t.donation.errorCardType,
        localCard: t.donation.errorLocalCard,
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

      <CardField
        title={t.donation.localCardTitle}
        hint={t.donation.localCardHint}
        name="cardNumber"
        typeName="cardType"
        types={LOCAL_CARD_TYPES}
        auto
        initialNumber={local?.number ?? null}
        initialType={local?.type ?? null}
        placeholder="8600 0000 0000 0000"
      />
      <CardField
        title={t.donation.intlCardTitle}
        hint={t.donation.intlCardHint}
        name="intlCardNumber"
        typeName="intlCardType"
        types={INTL_CARD_TYPES}
        initialNumber={intl?.number ?? null}
        initialType={intl?.type ?? null}
        placeholder="4000 0000 0000 0000"
      />

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
