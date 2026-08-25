import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getAllRequestsAdmin } from "@/lib/queries/admin";
import { requestStatusTone, requestStatusLabel } from "@/lib/requestStatus";
import { AdminHeader } from "../AdminHeader";
import { Badge } from "@/components/ui/Chip";
import { RequestActions } from "./RequestActions";

export default async function AdminRequestsPage() {
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const requests = await getAllRequestsAdmin();

  return (
    <div>
      <AdminHeader title={t.admin.requests} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <div className="rounded-[22px] border border-border bg-card p-4.5 sm:p-6.5">
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="mb-3 flex items-center gap-4 border-b border-border-soft pb-3 text-[12px] font-bold uppercase tracking-wide text-muted-2">
                <span className="flex-[1.4]">{t.admin.colTitle}</span>
                <span className="w-32.5">{t.admin.colRequester}</span>
                <span className="w-27.5">{t.admin.colDate}</span>
                <span className="w-25">{t.admin.colStatus}</span>
                <span className="w-42.5 text-right">{t.admin.colAction}</span>
              </div>

              {requests.length > 0 ? (
                requests.map((r) => {
                  const from = r.from_user as unknown as { display_name: string } | null;
                  return (
                    <div key={r.id} className="flex items-center gap-4 border-b border-border-soft py-3.5 last:border-0">
                      <span className="flex-[1.4] truncate text-[13.5px] font-semibold text-ink-soft">{r.title}</span>
                      <span className="w-32.5 text-[13.5px] text-ink-soft">{from?.display_name}</span>
                      <span className="w-27.5 text-[13px] text-muted-2">
                        {new Date(r.created_at).toLocaleDateString(locale)}
                      </span>
                      <span className="w-25">
                        <Badge tone={requestStatusTone(r.status)}>{requestStatusLabel(t, r.status)}</Badge>
                      </span>
                      <span className="w-42.5">
                        <RequestActions requestId={r.id} status={r.status} />
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-[13.5px] text-muted">{t.admin.emptyGeneric}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
