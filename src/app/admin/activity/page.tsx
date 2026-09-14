import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getRecentActivity, getActivityCounts } from "@/lib/queries/admin";
import { ROUTES } from "@/lib/constants";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { UserIcon, LibraryIcon, CommentsIcon } from "@/components/ui/icons";
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
  const range = { from, to: to ? `${to}T23:59:59.999` : undefined };
  const hasRange = Boolean(from || to);
  const [activity, counts] = await Promise.all([
    getRecentActivity(MAX_ITEMS, range),
    hasRange ? getActivityCounts(range) : Promise.resolve(null),
  ]);

  return (
    <div>
      <AdminHeader title={t.admin.recentActivity} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <form className="mb-5 flex flex-wrap items-end gap-3 rounded-[14px] border border-border bg-card p-4.5 sm:p-6.5">
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

        {counts && (
          <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {(
              [
                [t.admin.activityStatsNewUsers, counts.newUsers, UserIcon, "bg-blue-100 dark:bg-blue-950", "text-blue-700 dark:text-blue-300"],
                [t.admin.activityStatsPublishedChapters, counts.publishedChapters, LibraryIcon, "bg-primary-100", "text-primary-700"],
                [t.admin.activityStatsNewComments, counts.newComments, CommentsIcon, "bg-amber-100 dark:bg-amber-950", "text-amber-700 dark:text-amber-300"],
              ] as const
            ).map(([label, value, Icon, bg, fg]) => (
              <div key={label} className="rounded-[14px] border border-border bg-card px-6 py-5.5">
                <div className="mb-3.5 flex items-center gap-2.5">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${bg} ${fg}`}>
                    <Icon width={18} height={18} />
                  </span>
                  <span className="text-[14px] text-muted-2">{label}</span>
                </div>
                <div className="text-[32px] font-extrabold tracking-tight">{value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-[14px] border border-border bg-card px-6.5 py-6">
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
