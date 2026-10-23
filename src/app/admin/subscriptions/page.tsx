import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getStaffSession } from "@/server/auth/staff";
import { getDb } from "@/server/db/client";
import { listOpenClaims, listSubscribers, listSubscriptionEvents, loadPaywallState, type PaywallState } from "@/server/data/paywall";
import { logQueryError } from "@/lib/queries/query-errors";
import { formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/constants";
import { AdminHeader } from "../AdminHeader";
import { Badge } from "@/components/ui/Chip";
import { PaywallSettingsForm } from "./PaywallSettingsForm";
import { GrantSubscriptionForm } from "./GrantSubscriptionForm";
import { RevokeSubscriptionButton } from "./RevokeSubscriptionButton";

// «Obuna» for admins: the switch and test dates, prices and texts, opening a
// subscription by hand, who is subscribed, payments waiting in Telegram, and
// the history. Moderators don't see this page — it is about money.

// <input type="datetime-local"> value in Tashkent time (UTC+5).
function toLocalInput(d: Date | null | undefined): string {
  return d ? new Date(d.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 16) : "";
}

export default async function AdminSubscriptionsPage() {
  const staff = await getStaffSession();
  if (staff.status !== "staff") redirect(ROUTES.adminLogin);
  if (!staff.staff.isAdmin) redirect(ROUTES.admin);

  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const p = t.paywall;
  const now = new Date();

  let state: PaywallState | null = null;
  let subscribers: Awaited<ReturnType<typeof listSubscribers>> = [];
  let claims: Awaited<ReturnType<typeof listOpenClaims>> = [];
  let events: Awaited<ReturnType<typeof listSubscriptionEvents>> = [];
  try {
    const db = getDb();
    [state, subscribers, claims, events] = await Promise.all([
      loadPaywallState(db, now),
      listSubscribers(db, now),
      listOpenClaims(db, now),
      listSubscriptionEvents(db),
    ]);
  } catch (err) {
    logQueryError("adminSubscriptions", err);
  }

  if (!state?.settings) {
    return (
      <div>
        <AdminHeader title={p.adminTitle} />
        <p className="px-4 pt-7 text-[14px] text-danger sm:px-8.5">{t.common.error} — D:\QIZLAB\backups\paywall.sql</p>
      </div>
    );
  }

  const s = state.settings;
  const fmt = (d: Date) => formatDateTime(d.toISOString(), locale);
  const status = !s.enabled
    ? { tone: "neutral" as const, text: p.adminStatusOff }
    : state.live
      ? { tone: "success" as const, text: p.adminStatusLive }
      : s.starts_at && s.starts_at > now
        ? { tone: "warning" as const, text: p.adminStatusScheduled.replace("{date}", fmt(s.starts_at)) }
        : { tone: "neutral" as const, text: p.adminStatusEnded.replace("{date}", s.ends_at ? fmt(s.ends_at) : "") };

  return (
    <div>
      <AdminHeader title={p.adminTitle} />
      <div className="flex flex-col gap-5 px-4 pb-15 pt-7 sm:px-8.5">
        <section className="rounded-[14px] border border-border bg-card p-4.5 sm:p-6.5">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <h3 className="text-[17px] font-extrabold">{p.adminSettings}</h3>
            <Badge tone={status.tone}>{status.text}</Badge>
          </div>
          <PaywallSettingsForm
            initial={{
              enabled: s.enabled,
              startsAt: toLocalInput(s.starts_at),
              endsAt: toLocalInput(s.ends_at),
              readerFreeChapters: s.reader_free_chapters,
              authorFreeChapters: s.author_free_chapters,
              periodDays: s.period_days,
              quoteTrials: s.quote_trials,
              price: s.price,
              cardNumber: s.card_number ?? "",
              cardType: s.card_type ?? "",
              cardHolder: s.card_holder ?? "",
              messageUz: s.message_uz ?? "",
              messageRu: s.message_ru ?? "",
            }}
          />
          <p className="mt-4 text-[12.5px] leading-relaxed text-muted-2">{p.adminBotHint}</p>
        </section>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <section className="rounded-[14px] border border-border bg-card p-4.5 sm:p-6.5">
            <h3 className="mb-4 text-[17px] font-extrabold">{p.adminGrantTitle}</h3>
            <GrantSubscriptionForm defaultDays={s.period_days} />
          </section>

          <section className="rounded-[14px] border border-border bg-card p-4.5 sm:p-6.5">
            <h3 className="mb-4 text-[17px] font-extrabold">{p.adminClaims}</h3>
            {claims.length === 0 ? (
              <p className="text-[13.5px] text-muted-2">{p.adminNoClaims}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border-soft">
                {claims.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <Link prefetch={false} href={ROUTES.author(c.username)} className="text-[14px] font-bold">
                        @{c.username}
                      </Link>
                      {c.telegram_username && <span className="ml-2 text-[12.5px] text-muted-2">TG @{c.telegram_username}</span>}
                      <div className="text-[12px] text-muted-2">{fmt(c.submitted_at ?? c.created_at)}</div>
                    </div>
                    <Badge tone={c.status === "submitted" ? "warning" : "neutral"}>
                      {c.status === "submitted" ? p.adminClaimSubmitted : p.adminClaimAwaiting}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-[14px] border border-border bg-card p-4.5 sm:p-6.5">
          <h3 className="mb-4 text-[17px] font-extrabold">
            {p.adminSubscribers} <span className="text-[14px] font-semibold text-muted-2">{subscribers.filter((x) => x.expires_at > now).length}</span>
          </h3>
          {subscribers.length === 0 ? (
            <p className="text-[13.5px] text-muted-2">{p.adminNoSubscribers}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-soft">
              {subscribers.map((row) => {
                const active = row.expires_at > now;
                return (
                  <li key={row.user_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link prefetch={false} href={ROUTES.author(row.username)} className="text-[14px] font-bold">
                        {row.display_name}
                      </Link>
                      <span className="ml-2 text-[12.5px] text-muted-2">@{row.username}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={active ? "success" : "neutral"}>
                        {(active ? p.adminExpires : p.adminExpired).replace("{date}", fmt(row.expires_at))}
                      </Badge>
                      {active && <RevokeSubscriptionButton userId={row.user_id} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-[14px] border border-border bg-card p-4.5 sm:p-6.5">
          <h3 className="mb-4 text-[17px] font-extrabold">{p.adminHistory}</h3>
          <ul className="flex flex-col gap-2 text-[13.5px]">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-2">
                <span className="text-muted-2">{fmt(e.created_at)}</span>
                <span className="font-bold">@{e.username}</span>
                <span>{e.kind === "grant" ? p.adminEventGrant.replace("{days}", String(e.days ?? "")) : p.adminEventRevoke}</span>
                <span className="text-muted-2">
                  {e.by_username ? `— @${e.by_username}` : e.by_telegram ? `— ${p.adminByTelegram} ${e.by_telegram}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
