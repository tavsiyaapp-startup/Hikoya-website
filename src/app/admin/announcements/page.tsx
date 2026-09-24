import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getAllAnnouncementsAdmin } from "@/lib/queries/admin";
import { AdminHeader } from "../AdminHeader";
import { AnnouncementForm } from "./AnnouncementForm";
import { AnnouncementListItem } from "./AnnouncementListItem";

export default async function AdminAnnouncementsPage() {
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const announcements = await getAllAnnouncementsAdmin();

  return (
    <div>
      <AdminHeader title={t.admin.announcements} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <div className="mb-5 rounded-[14px] border border-border bg-card p-4.5 sm:p-6.5">
          <p className="mb-5 text-[13.5px] text-muted-2">{t.admin.announcementsHint}</p>
          <AnnouncementForm />
        </div>

        <div className="rounded-[14px] border border-border bg-card p-4.5 sm:p-6.5">
          <h3 className="mb-3 text-[15px] font-extrabold">{t.admin.announcementsCurrent}</h3>
          {announcements.length > 0 ? (
            announcements.map((announcement) => (
              <AnnouncementListItem key={announcement.id} announcement={announcement} />
            ))
          ) : (
            <div className="py-6 text-center text-[13.5px] text-muted">{t.admin.announcementsNoneYet}</div>
          )}
        </div>
      </div>
    </div>
  );
}
