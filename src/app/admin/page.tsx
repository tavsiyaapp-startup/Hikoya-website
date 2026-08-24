import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import {
  getAdminStats,
  getRecentStoriesAdmin,
  getRecentUsersAdmin,
  getRecentReportsAdmin,
} from "@/lib/queries/admin";
import { ROUTES } from "@/lib/constants";
import { Badge } from "@/components/ui/Chip";
import { AdminHeader } from "./AdminHeader";

export default async function AdminDashboardPage() {
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  const [stats, stories, users, reports] = await Promise.all([
    getAdminStats(),
    getRecentStoriesAdmin(5),
    getRecentUsersAdmin(5),
    getRecentReportsAdmin(5),
  ]);

  const cards = [
    { label: t.admin.stories, value: stats.storyCount },
    { label: t.admin.users, value: stats.userCount },
    { label: t.common.views, value: stats.totalViews },
    { label: t.common.comments, value: stats.commentCount },
  ];

  return (
    <div>
      <AdminHeader title={t.admin.dashboard} />
      <div className="px-8.5 pb-15 pt-7">
        <div className="mb-6 grid grid-cols-4 gap-5">
          {cards.map((c) => (
            <div key={c.label} className="rounded-[20px] border border-border bg-card px-6 py-5.5">
              <div className="mb-3.5 text-[14px] text-muted-2">{c.label}</div>
              <div className="text-[32px] font-extrabold tracking-tight">{c.value}</div>
            </div>
          ))}
        </div>

        <div className="mb-5 grid grid-cols-2 gap-5">
          <div className="rounded-[20px] border border-border bg-card px-6.5 py-6">
            <h3 className="mb-4.5 text-[17px] font-extrabold">{t.admin.allUsers}</h3>
            <div className="flex flex-col gap-3">
              {users.length > 0 ? (
                users.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 border-b border-border-soft pb-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-bold">{u.display_name}</div>
                      <div className="text-[12.5px] text-muted-2">@{u.username}</div>
                    </div>
                    <Badge tone={u.status === "active" ? "success" : "danger"}>{u.status}</Badge>
                  </div>
                ))
              ) : (
                <EmptyLine text={t.admin.emptyGeneric} />
              )}
            </div>
            <Link href={`${ROUTES.admin}/users`} className="mt-4 inline-block text-[13.5px] font-bold">
              {t.admin.allUsers} →
            </Link>
          </div>

          <div className="rounded-[20px] border border-border bg-card px-6.5 py-6">
            <h3 className="mb-4.5 text-[17px] font-extrabold">{t.admin.allReports}</h3>
            <div className="flex flex-col gap-3">
              {reports.length > 0 ? (
                reports.map((r) => (
                  <div key={r.id} className="border-b border-border-soft pb-3 last:border-0">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge tone="danger">{r.target_type}</Badge>
                      <span className="text-[12.5px] text-muted-2">{r.reason}</span>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyLine text={t.admin.emptyGeneric} />
              )}
            </div>
            <Link href={`${ROUTES.admin}/reports`} className="mt-4 inline-block text-[13.5px] font-bold">
              {t.admin.allReports} →
            </Link>
          </div>
        </div>

        <div className="rounded-[20px] border border-border bg-card px-6.5 py-6">
          <h3 className="mb-4.5 text-[17px] font-extrabold">{t.admin.allStories}</h3>
          <div className="flex flex-col gap-3">
            {stories.length > 0 ? (
              stories.map((s) => {
                const author = s.author as unknown as { display_name: string } | null;
                return (
                  <div key={s.id} className="flex items-center gap-3.5 border-b border-border-soft pb-3 last:border-0">
                    <span className="text-[14px] font-bold">{s.title}</span>
                    <span className="text-[13.5px] text-muted-2">{author?.display_name}</span>
                    <Badge tone={s.status === "published" ? "success" : "neutral"} className="ml-auto">
                      {s.status}
                    </Badge>
                  </div>
                );
              })
            ) : (
              <EmptyLine text={t.admin.emptyGeneric} />
            )}
          </div>
          <Link href={`${ROUTES.admin}/stories`} className="mt-4 inline-block text-[13.5px] font-bold">
            {t.admin.allStories} →
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="py-3 text-center text-[13.5px] text-muted">{text}</div>;
}
