import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import {
  searchUsersAdmin,
  getAllAchievements,
  getUserAchievementsMap,
  getAuthorStoryCounts,
  getAuthorFollowerCounts,
} from "@/lib/queries/admin";
import type { AdminUserSort } from "@/lib/queries/admin";
import { AdminHeader } from "../AdminHeader";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LinkChip } from "@/components/ui/LinkChip";
import { UserRow } from "./UserRow";

const SORTS: AdminUserSort[] = ["newest", "followers", "stories"];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { q, sort: rawSort } = await searchParams;
  const sort: AdminUserSort = SORTS.includes(rawSort as AdminUserSort) ? (rawSort as AdminUserSort) : "newest";
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const [users, viewer, achievements] = await Promise.all([
    searchUsersAdmin(q, sort),
    getCurrentUser(),
    getAllAchievements(),
  ]);
  const userIds = users.map((u) => u.id);
  const [achievementsByUser, storyCounts, followerCounts] = await Promise.all([
    getUserAchievementsMap(userIds),
    getAuthorStoryCounts(userIds),
    getAuthorFollowerCounts(userIds),
  ]);
  const viewerIsAdmin = viewer?.profile?.role === "admin";

  function buildHref(overrides: { sort?: AdminUserSort }) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const mergedSort = overrides.sort ?? sort;
    if (mergedSort !== "newest") params.set("sort", mergedSort);
    return `?${params.toString()}`;
  }

  const sortLabels: Record<AdminUserSort, string> = {
    newest: t.search.sortNewest,
    followers: t.admin.sortByFollowers,
    stories: t.admin.sortByStories,
  };

  return (
    <div>
      <AdminHeader title={t.admin.users} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <div className="rounded-[14px] border border-border bg-card p-4.5 sm:p-6.5">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <form className="flex max-w-105 flex-1 gap-2">
              {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
              <Input name="q" defaultValue={q} placeholder={t.admin.searchUsers} />
              <Button type="submit" variant="secondary" className="shrink-0">
                {t.admin.filterApply}
              </Button>
            </form>
            <div className="flex gap-2 overflow-x-auto">
              {SORTS.map((s) => (
                <LinkChip key={s} href={buildHref({ sort: s })} active={sort === s} shrink>
                  {sortLabels[s]}
                </LinkChip>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[1040px]">
              <div className="mb-3 flex items-center gap-4 border-b border-border-soft pb-3 text-[12px] font-bold uppercase tracking-wide text-muted-2">
                <span className="flex-[1.4]">{t.admin.colUser}</span>
                <span className="w-27.5">{t.admin.colRole}</span>
                <span className="w-20">{t.admin.colStories}</span>
                <span className="w-24">{t.admin.colFollowers}</span>
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
                  storyCount={storyCounts[u.id] ?? 0}
                  followerCount={followerCounts[u.id] ?? 0}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
