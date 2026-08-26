import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { searchUsersAdmin, getAllAchievements, getUserAchievementsMap } from "@/lib/queries/admin";
import { AdminHeader } from "../AdminHeader";
import { Input } from "@/components/ui/Input";
import { UserRow } from "./UserRow";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const [users, viewer, achievements] = await Promise.all([
    searchUsersAdmin(q),
    getCurrentUser(),
    getAllAchievements(),
  ]);
  const achievementsByUser = await getUserAchievementsMap(users.map((u) => u.id));
  const viewerIsAdmin = viewer?.profile?.role === "admin";

  return (
    <div>
      <AdminHeader title={t.admin.users} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <div className="rounded-[22px] border border-border bg-card p-4.5 sm:p-6.5">
          <form className="mb-5 max-w-105">
            <Input name="q" defaultValue={q} placeholder={t.admin.searchUsers} />
          </form>

          <div className="overflow-x-auto">
            <div className="min-w-[960px]">
              <div className="mb-3 flex items-center gap-4 border-b border-border-soft pb-3 text-[12px] font-bold uppercase tracking-wide text-muted-2">
                <span className="flex-[1.4]">{t.admin.colUser}</span>
                <span className="w-27.5">{t.admin.colRole}</span>
                <span className="w-22.5">{t.admin.colStories}</span>
                <span className="w-32.5">{t.admin.colRegistered}</span>
                <span className="w-30">{t.admin.colStatus}</span>
                <span className="w-24 shrink-0">{t.admin.colVerified}</span>
                <span className="w-32 shrink-0">{t.admin.manageBadges}</span>
                <span className="w-30 shrink-0 text-right">{t.admin.colAction}</span>
              </div>

              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  viewerIsAdmin={viewerIsAdmin}
                  locale={locale}
                  achievements={achievements}
                  initialCheckedIds={achievementsByUser.get(u.id) ?? []}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
