import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { countAnnouncementRecipients, getSentAnnouncements } from "@/lib/queries/admin";
import { formatDateTime } from "@/lib/format";
import { getStaffSession } from "@/server/auth/staff";
import { AdminHeader } from "../AdminHeader";
import { BroadcastForm } from "./BroadcastForm";

// Announcement to authors, readers or everyone: a notification plus a
// one-time popup on their next visit. Sending is admin-only (re-checked in
// sendAnnouncement); moderators only see a note.
export default async function BroadcastPage() {
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const [staff, counts, sent] = await Promise.all([
    getStaffSession(),
    countAnnouncementRecipients(),
    getSentAnnouncements(),
  ]);
  const isAdmin = staff.status === "staff" && staff.staff.isAdmin;

  return (
    <div>
      <AdminHeader title={t.admin.broadcastTitle} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <div className="max-w-180 rounded-[14px] border border-border bg-card p-4.5 sm:p-6.5">
          <p className="mb-5 text-[13.5px] leading-relaxed text-muted-2">{t.admin.broadcastBody}</p>
          {isAdmin ? (
            <BroadcastForm counts={counts} />
          ) : (
            <p className="text-[13.5px] font-semibold text-danger">{t.admin.broadcastAdminOnly}</p>
          )}
        </div>

        <h2 className="mb-3.5 mt-8 text-[18px] font-extrabold tracking-tight">{t.admin.broadcastHistory}</h2>
        {sent.length > 0 ? (
          <div className="flex max-w-180 flex-col gap-3">
            {sent.map((b) => (
              <div key={`${b.sentAt}-${b.message.slice(0, 20)}`} className="rounded-[14px] border border-border bg-card p-4.5">
                <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-2">
                  <span className="font-bold text-ink-soft">{formatDateTime(b.sentAt, locale)}</span>
                  <span>{t.admin.broadcastHistoryRecipients.replace("{count}", String(b.recipients))}</span>
                  <span>{t.admin.broadcastHistoryRead.replace("{count}", String(b.read))}</span>
                </div>
                <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink-soft">{b.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13.5px] text-muted-2">{t.admin.broadcastHistoryEmpty}</p>
        )}
      </div>
    </div>
  );
}
