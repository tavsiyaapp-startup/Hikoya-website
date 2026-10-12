import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getStaffSession } from "@/server/auth/staff";
import { getDb } from "@/server/db/client";
import { loadViewer } from "@/server/data/viewer";
import { listOpenReports } from "@/server/data/comments";
import { logQueryError } from "@/lib/queries/query-errors";
import { formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/constants";
import { AdminHeader } from "../AdminHeader";
import { Badge } from "@/components/ui/Chip";
import { ReportActions } from "./ReportActions";

// Queue of open comment complaints, oldest first. Each one can be dismissed,
// or acted on by hiding the comment or blocking its author.
export default async function AdminReportsPage() {
  const staff = await getStaffSession();
  if (staff.status !== "staff") redirect(ROUTES.adminLogin);

  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const db = getDb();
  const viewer = await loadViewer(db, staff.staff.id);

  let reports: Awaited<ReturnType<typeof listOpenReports>> = [];
  let loadFailed = false;
  try {
    reports = await listOpenReports(db, viewer);
  } catch (err) {
    logQueryError("listOpenReports", err);
    loadFailed = true;
  }

  const reasonLabels: Record<string, string> = {
    spam: t.reader.reportReasonSpam,
    abuse: t.reader.reportReasonAbuse,
    spoiler: t.reader.reportReasonSpoiler,
    other: t.reader.reportReasonOther,
  };

  return (
    <div>
      <AdminHeader title={t.admin.reports} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        {loadFailed ? (
          <div className="rounded-[12px] border border-danger bg-danger-bg px-6 py-6 text-[14px] text-danger">
            {t.admin.reportsLoadError}
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-border-soft bg-surface px-6 py-14 text-center text-[14px] text-muted">
            {t.admin.reportsEmpty}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {reports.map((r) => (
              <div key={r.id} className="rounded-[12px] border border-border bg-card p-4.5 sm:p-5.5">
                <div className="mb-2.5 flex flex-wrap items-center gap-2.5 text-[12.5px] text-muted-2">
                  <Badge tone="warning">{reasonLabels[r.reason] ?? r.reason}</Badge>
                  <span>
                    {t.admin.reportFrom}: <b className="text-ink-soft">@{r.reporter_username}</b>
                  </span>
                  <span>
                    {t.admin.reportCommentAuthor}: <b className="text-ink-soft">@{r.author_username}</b>
                  </span>
                  <span>{formatDateTime(r.created_at.toISOString(), locale)}</span>
                  {r.comment_hidden_at && <Badge tone="neutral">{t.admin.reportAlreadyHidden}</Badge>}
                </div>
                <p className="mb-2 whitespace-pre-wrap rounded-[10px] bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-soft">
                  {r.comment_text}
                </p>
                {r.details && <p className="mb-2 text-[13px] italic text-muted-2">«{r.details}»</p>}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={r.chapter_id ? ROUTES.adminChapter(r.story_id, r.chapter_id) : ROUTES.adminStory(r.story_id)}
                    className="text-[13px] font-bold text-primary-800 hover:underline"
                  >
                    {t.admin.reportOpenStory}
                  </Link>
                  <ReportActions
                    reportId={r.id}
                    canHide={!r.comment_hidden_at}
                    canBlock={r.author_role !== "admin" || staff.staff.isAdmin}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
