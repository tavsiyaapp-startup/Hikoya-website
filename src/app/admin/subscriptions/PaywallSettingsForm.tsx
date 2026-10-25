"use client";

import { useActionState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { savePaywallSettings, type PaywallAdminResult } from "@/lib/actions/paywall";
import { CARD_TYPE_LABEL, formatCardNumber, type CardType } from "@/lib/card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

type Initial = {
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  readerFreeChapters: number;
  authorFreeChapters: number;
  periodDays: number;
  quoteTrials: number;
  price: string;
  cardNumber: string;
  cardType: string;
  cardHolder: string;
  messageUz: string;
  messageRu: string;
};

export function PaywallSettingsForm({ initial }: { initial: Initial }) {
  const { t } = useLocale();
  const p = t.paywall;
  const [result, action, pending] = useActionState<PaywallAdminResult | null, FormData>(savePaywallSettings, null);

  const errors: Record<string, string> = {
    date: p.adminErrDate,
    dateOrder: p.adminErrDateOrder,
    number: p.adminErrNumber,
    card: p.adminErrCard,
  };

  const label = "mb-1.5 block text-[13px] font-bold";
  const hint = "mt-1 text-[12px] leading-relaxed text-muted-2";

  return (
    <form action={action} className="flex flex-col gap-5">
      <label className="flex cursor-pointer items-center gap-4.5 rounded-[12px] border border-border-soft bg-surface px-4.5 py-4">
        <span className="min-w-0 flex-1">
          <span className="mb-0.5 block text-[14.5px] font-bold">{p.adminEnabled}</span>
          <span className="block text-[13px] leading-relaxed text-muted-2">{p.adminEnabledHint}</span>
        </span>
        <input type="checkbox" name="enabled" defaultChecked={initial.enabled} className="h-5 w-5 shrink-0" />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>{p.adminStartsAt}</label>
          <Input type="datetime-local" name="startsAt" defaultValue={initial.startsAt} />
          <p className={hint}>{p.adminStartsAtHint}</p>
        </div>
        <div>
          <label className={label}>{p.adminEndsAt}</label>
          <Input type="datetime-local" name="endsAt" defaultValue={initial.endsAt} />
          <p className={hint}>{p.adminEndsAtHint}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div>
          <label className={label}>{p.adminReaderFree}</label>
          <Input type="number" min={0} max={1000} name="readerFreeChapters" defaultValue={initial.readerFreeChapters} required />
        </div>
        <div>
          <label className={label}>{p.adminAuthorFree}</label>
          <Input type="number" min={0} max={1000} name="authorFreeChapters" defaultValue={initial.authorFreeChapters} required />
        </div>
        <div>
          <label className={label}>{p.adminPeriodDays}</label>
          <Input type="number" min={1} max={3660} name="periodDays" defaultValue={initial.periodDays} required />
        </div>
        <div>
          <label className={label}>{p.adminQuoteTrials}</label>
          <Input type="number" min={0} max={1000} name="quoteTrials" defaultValue={initial.quoteTrials} required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={label}>{p.adminPrice}</label>
          <Input name="price" defaultValue={initial.price} maxLength={60} />
        </div>
        <div>
          <label className={label}>{p.adminCard}</label>
          <Input name="cardNumber" defaultValue={formatCardNumber(initial.cardNumber)} inputMode="numeric" autoComplete="off" placeholder="8600 0000 0000 0000" className="font-mono" />
        </div>
        <div>
          <label className={label}>{p.adminCardType}</label>
          <select
            name="cardType"
            defaultValue={initial.cardType}
            className="h-12.5 w-full rounded-[14px] border border-border bg-surface px-4 text-[15px]"
          >
            <option value="">—</option>
            {(Object.keys(CARD_TYPE_LABEL) as CardType[]).map((k) => (
              <option key={k} value={k}>
                {CARD_TYPE_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>{p.adminCardHolder}</label>
          <Input name="cardHolder" defaultValue={initial.cardHolder} maxLength={60} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <label className={label}>{p.adminMessageUz}</label>
          <Textarea name="messageUz" defaultValue={initial.messageUz} rows={3} placeholder={p.adminMessageHint} />
        </div>
        <div>
          <label className={label}>{p.adminMessageRu}</label>
          <Textarea name="messageRu" defaultValue={initial.messageRu} rows={3} placeholder={p.adminMessageHint} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t.common.loading : t.common.save}
        </Button>
        {result?.ok && <span className="text-[13px] font-bold text-success">{p.adminSaved}</span>}
        {result && !result.ok && <span className="text-[13px] text-danger">{errors[result.error] ?? t.common.error}</span>}
      </div>
    </form>
  );
}
