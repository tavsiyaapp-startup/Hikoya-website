import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { searchUsersAdmin } from "@/lib/queries/admin";
import { AdminHeader } from "../AdminHeader";
import { Badge } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { UserStatusButton } from "./UserStatusButton";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const users = await searchUsersAdmin(q);

  return (
    <div>
      <AdminHeader title={t.admin.users} />
      <div className="px-8.5 pb-15 pt-7">
        <div className="rounded-[22px] border border-border bg-card p-6.5">
          <form className="mb-5 max-w-105">
            <Input name="q" defaultValue={q} placeholder={t.admin.searchUsers} />
          </form>

          <div className="mb-3 flex items-center gap-4 border-b border-border-soft pb-3 text-[12px] font-bold uppercase tracking-wide text-muted-2">
            <span className="flex-[1.4]">Пользователь</span>
            <span className="w-27.5">Роль</span>
            <span className="w-22.5">Истории</span>
            <span className="w-32.5">Регистрация</span>
            <span className="w-30">Статус</span>
            <span className="w-30 text-right">Действие</span>
          </div>

          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-4 border-b border-border-soft py-3.5 last:border-0">
              <div className="min-w-0 flex-[1.4]">
                <div className="text-[14px] font-bold">{u.display_name}</div>
                <div className="text-[12.5px] text-muted-2">@{u.username}</div>
              </div>
              <span className="w-27.5 text-[13.5px] text-ink-soft">{u.role}</span>
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
  );
}
