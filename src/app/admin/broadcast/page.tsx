import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { countAnnouncementRecipients } from "@/lib/queries/admin";
import { getStaffSession } from "@/server/auth/staff";
import { AdminHeader } from "../AdminHeader";
import { BroadcastForm } from "./BroadcastForm";

const DEFAULT_TEXT = `Mualliflar, bizga yozing! ✍️
Siz uchun yangiliklar va takliflarimiz bor! 🎁
Telegram botimizga ism va telefon raqamingizni qoldiring: @hikoya_auth_bot 📲`;

// Announcement to authors, readers or everyone: a notification plus a
// one-time popup on their next visit. Sending is admin-only (re-checked in
// sendAnnouncement); moderators only see a note.
export default async function BroadcastPage() {
  const t = getDictionary(await getServerLocale());
  const [staff, counts] = await Promise.all([getStaffSession(), countAnnouncementRecipients()]);
  const isAdmin = staff.status === "staff" && staff.staff.isAdmin;

  return (
    <div>
      <AdminHeader title={t.admin.broadcastTitle} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <div className="max-w-180 rounded-[14px] border border-border bg-card p-4.5 sm:p-6.5">
          <p className="mb-5 text-[13.5px] leading-relaxed text-muted-2">{t.admin.broadcastBody}</p>
          {isAdmin ? (
            <BroadcastForm counts={counts} defaultText={DEFAULT_TEXT} />
          ) : (
            <p className="text-[13.5px] font-semibold text-danger">{t.admin.broadcastAdminOnly}</p>
          )}
        </div>
      </div>
    </div>
  );
}
