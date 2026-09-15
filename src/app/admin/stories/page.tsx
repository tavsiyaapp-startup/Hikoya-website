import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getAllStoriesAdmin, getStoryChapterCounts, getPendingChapterCounts } from "@/lib/queries/admin";
import type { AdminStorySort } from "@/lib/queries/admin";
import { AdminHeader } from "../AdminHeader";
import { Badge, Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LinkChip } from "@/components/ui/LinkChip";
import { ROUTES } from "@/lib/constants";

const SORTS: AdminStorySort[] = ["newest", "views", "likes"];

export default async function AdminStoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; sort?: string }>;
}) {
  const { status, q, sort: rawSort } = await searchParams;
  const sort: AdminStorySort = SORTS.includes(rawSort as AdminStorySort) ? (rawSort as AdminStorySort) : "newest";
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const stories = await getAllStoriesAdmin(status, { q, sort });
  const storyIds = stories.map((s) => s.id);
  const [chapterCounts, pendingChapterCounts] = await Promise.all([
    getStoryChapterCounts(storyIds),
    getPendingChapterCounts(storyIds),
  ]);

  function buildHref(overrides: { status?: string; sort?: AdminStorySort }) {
    const params = new URLSearchParams();
    const merged = { status, sort, ...overrides };
    if (merged.status) params.set("status", merged.status);
    if (q) params.set("q", q);
    if (merged.sort !== "newest") params.set("sort", merged.sort);
    return `?${params.toString()}`;
  }

  const sortLabels: Record<AdminStorySort, string> = {
    newest: t.search.sortNewest,
    views: t.search.sortViews,
    likes: t.search.sortPopular,
  };

  return (
    <div>
      <AdminHeader title={t.admin.stories} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <div className="rounded-[14px] border border-border bg-card p-4.5 sm:p-6.5">
          <div className="mb-5 flex gap-2 overflow-x-auto">
            {[undefined, "pending_review", "published", "draft", "unlisted", "deleted"].map((s) => (
              <Link key={s ?? "all"} href={buildHref({ status: s })} className="shrink-0">
                <Chip active={status === s || (!status && !s)}>{s === "deleted" ? t.admin.trash : (s ?? t.common.all)}</Chip>
              </Link>
            ))}
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-3">
            <form className="flex max-w-105 flex-1 gap-2">
              {status && <input type="hidden" name="status" value={status} />}
              {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
              <Input name="q" defaultValue={q} placeholder={t.admin.searchStories} />
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
            <div className="min-w-[720px]">
              <div className="mb-3 flex items-center gap-4 border-b border-border-soft pb-3 text-[12px] font-bold uppercase tracking-wide text-muted-2">
                <span className="flex-[1.6]">{t.admin.colStory}</span>
                <span className="flex-1">{t.admin.colAuthor}</span>
                <span className="w-22">{t.admin.colChapters}</span>
                <span className="w-24">{t.admin.colViews}</span>
                <span className="w-20">{t.admin.colLikes}</span>
                <span className="w-32.5">{t.admin.colStatus}</span>
              </div>

              {stories.map((s) => {
                const author = s.author as unknown as { display_name: string } | null;
                return (
                  <Link
                    key={s.id}
                    href={ROUTES.adminStory(s.id)}
                    className="flex items-center gap-4 border-b border-border-soft py-3.5 last:border-0 hover:bg-surface"
                  >
                    <span className="flex-[1.6] truncate text-[14.5px] font-bold">{s.title}</span>
                    <span className="flex-1 text-[13.5px] text-ink-soft">{author?.display_name}</span>
                    <span className="w-22 text-[13.5px] text-ink-soft">{chapterCounts[s.id] ?? 0}</span>
                    <span className="w-24 text-[13.5px] text-ink-soft">{s.view_count}</span>
                    <span className="w-20 text-[13.5px] text-ink-soft">{s.like_count}</span>
                    <span className="flex w-32.5 flex-wrap items-center gap-1.5">
                      {s.deleted_at ? (
                        <Badge tone="danger">{t.admin.deletedByAuthor}</Badge>
                      ) : (
                        <Badge
                          tone={
                            s.status === "published" ? "success" : s.status === "pending_review" ? "warning" : "neutral"
                          }
                        >
                          {s.status}
                        </Badge>
                      )}
                      {pendingChapterCounts[s.id] > 0 && (
                        <Badge tone="warning">
                          {t.admin.pendingChaptersN.replace("{n}", String(pendingChapterCounts[s.id]))}
                        </Badge>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
