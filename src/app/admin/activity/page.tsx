import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getRecentActivity } from "@/lib/queries/admin";
import { ROUTES } from "@/lib/constants";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AdminHeader } from "../AdminHeader";
import { ActivityRow } from "../ActivityFeed";

const MAX_ITEMS = 300;

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  // `to` is a plain date (yyyy-mm-dd) from the <input type="date">, so lte
  // would otherwise cut off at that day's midnight — extend it through the
  // end of the day so the selected end date is actually included.
  const activity = await getRecentActivity(MAX_ITEMS, { from, to: to ? `${to}T23:59:59.999` : undefined });

  return (
    <div>
      <AdminHeader title={t.admin.recentActivity} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <form className="mb-5 flex flex-wrap items-end gap-3 rounded-[22px] border border-border bg-card p-4.5 sm:p-6.5">
          <div>
            <label className="mb-1.5 block text-[13px] font-bold">{t.admin.filterFrom}</label>
            <Input type="date" name="from" defaultValue={from} />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-bold">{t.admin.filterTo}</label>
            <Input type="date" name="to" defaultValue={to} />
          </div>
          <Button type="submit">{t.admin.filterApply}</Button>
          {(from || to) && (
            <Link
              href={`${ROUTES.admin}/activity`}
              className="flex h-[50px] items-center text-[13.5px] font-bold text-muted-2 hover:text-ink"
            >
              {t.admin.filterReset}
            </Link>
          )}
        </form>

        <div className="rounded-[20px] border border-border bg-card px-6.5 py-6">
          <div className="flex flex-col gap-3">
            {activity.length > 0 ? (
              activity.map((item) => <ActivityRow key={`${item.type}-${item.id}`} item={item} locale={locale} t={t} full />)
            ) : (
              <div className="py-8 text-center text-[13.5px] text-muted">{t.admin.noActivityYet}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
