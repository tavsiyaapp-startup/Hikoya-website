"use client";

import { useActionState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { grantSubscriptionByUsername, type PaywallAdminResult } from "@/lib/actions/paywall";
import { formatDateTime } from "@/lib/format";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

// Opens (or extends) a subscription by username — for payments that came
// some other way than the bot, or to give one as a gift.
export function GrantSubscriptionForm({ defaultDays }: { defaultDays: number }) {
  const { t, locale } = useLocale();
  const p = t.paywall;
  const [result, action, pending] = useActionState<PaywallAdminResult | null, FormData>(grantSubscriptionByUsername, null);

  let message: { ok: boolean; text: string } | null = null;
  if (result?.ok && result.message) {
    const [user, iso] = result.message.split("|");
    message = { ok: true, text: p.adminGranted.replace("{user}", user).replace("{date}", formatDateTime(iso, locale)) };
  } else if (result && !result.ok) {
    message = { ok: false, text: result.error === "notFound" ? p.adminNotFound : t.common.error };
  }

  return (
    <form action={action} className="flex flex-col gap-3.5">
      <div className="grid grid-cols-[1fr_96px] gap-3">
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">{p.adminGrantUsername}</label>
          <Input name="username" placeholder="@username" autoComplete="off" required />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">{p.adminGrantDays}</label>
          <Input type="number" name="days" min={1} max={3660} defaultValue={defaultDays} required />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t.common.loading : p.adminGrantButton}
        </Button>
        {message && <span className={message.ok ? "text-[13px] font-bold text-success" : "text-[13px] text-danger"}>{message.text}</span>}
      </div>
    </form>
  );
}
