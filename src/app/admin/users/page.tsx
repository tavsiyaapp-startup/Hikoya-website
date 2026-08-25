import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { searchUsersAdmin } from "@/lib/queries/admin";
import { AdminHeader } from "../AdminHeader";
import { Badge } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { UserStatusButton } from "./UserStatusButton";
import { UserRoleSelect } from "./UserRoleSelect";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const [users, viewer] = await Promise.all([searchUsersAdmin(q), getCurrentUser()]);
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
            <div className="min-w-[720px]">
              <div className="mb-3 flex items-center gap-4 border-b border-border-soft pb-3 text-[12px] font-bold uppercase tracking-wide text-muted-2">
                <span className="flex-[1.4]">{t.admin.colUser}</span>
                <span className="w-27.5">{t.admin.colRole}</span>
                <span className="w-22.5">{t.admin.colStories}</span>
                <span className="w-32.5">{t.admin.colRegistered}</span>
                <span className="w-30">{t.admin.colStatus}</span>
                <span className="w-30 text-right">{t.admin.colAction}</span>
              </div>

              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-4 border-b border-border-soft py-3.5 last:border-0">
                  <div className="min-w-0 flex-[1.4]">
                    <div className="text-[14px] font-bold">{u.display_name}</div>
                    <div className="text-[12.5px] text-muted-2">@{u.username}</div>
                  </div>
                  <span className="w-27.5">
                    <UserRoleSelect userId={u.id} role={u.role} disabled={!viewerIsAdmin} />
                  </span>
                  <span className="w-22.5 text-[13.5px] text-ink-soft">—</span>
                  <span className="w-32.5 text-[13.5px] text-muted-2">
                    {new Date(u.created_at).toLocaleDateString(locale)}
                  </span>
                  <span className="w-30">
                    <Badge tone={u.status === "active" ? "success" : "danger"}>{u.status}</Badge>
                  </span>
                  <span className="w-30 text-right">
                    <UserStatusButton userId={u.id} status={u.status} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
