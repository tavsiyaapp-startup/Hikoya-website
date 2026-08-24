import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getAllReportsAdmin, getReportStats } from "@/lib/queries/admin";
import { AdminHeader } from "../AdminHeader";
import { Badge } from "@/components/ui/Chip";
import { ReportActions } from "./ReportActions";

export default async function AdminReportsPage() {
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const [reports, stats] = await Promise.all([getAllReportsAdmin(), getReportStats()]);

  const cards = [
    { label: t.admin.statusOpenPlural, value: stats.open },
    { label: t.admin.statusReviewedPlural, value: stats.reviewed },
    { label: t.admin.statusResolvedPlural, value: stats.resolved },
  ];

  return (
    <div>
      <AdminHeader title={t.admin.reports} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <div className="mb-5.5 grid grid-cols-1 gap-5 xs:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-[20px] border border-border bg-card px-6 py-5">
              <div className="mb-2 text-[13.5px] text-muted-2">{c.label}</div>
              <div className="text-[28px] font-extrabold">{c.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-[22px] border border-border bg-card p-4.5 sm:p-6.5">
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="mb-3 flex items-center gap-4 border-b border-border-soft pb-3 text-[12px] font-bold uppercase tracking-wide text-muted-2">
                <span className="w-30">{t.admin.colType}</span>
                <span className="flex-[1.4]">{t.admin.colReason}</span>
                <span className="w-32.5">{t.admin.colReporter}</span>
                <span className="w-27.5">{t.admin.colDate}</span>
                <span className="w-42.5 text-right">{t.admin.colAction}</span>
              </div>

              {reports.length > 0 ? (
                reports.map((r) => {
                  const reporter = r.reporter as unknown as { display_name: string } | null;
                  return (
                    <div key={r.id} className="flex items-center gap-4 border-b border-border-soft py-3.5 last:border-0">
                      <span className="w-30">
                        <Badge tone="danger">{r.target_type}</Badge>
                      </span>
                      <span className="flex-[1.4] text-[13.5px] text-ink-soft">{r.reason}</span>
                      <span className="w-32.5 text-[13.5px] text-ink-soft">{reporter?.display_name}</span>
                      <span className="w-27.5 text-[13px] text-muted-2">
                        {new Date(r.created_at).toLocaleDateString(locale)}
                      </span>
                      <span className="w-42.5">
                        <ReportActions reportId={r.id} />
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-[13.5px] text-muted">{t.admin.noReportsYet}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
