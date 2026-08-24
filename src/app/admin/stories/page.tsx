import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getAllStoriesAdmin, getStoryChapterCounts } from "@/lib/queries/admin";
import { AdminHeader } from "../AdminHeader";
import { Badge, Chip } from "@/components/ui/Chip";
import { ROUTES } from "@/lib/constants";

export default async function AdminStoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const stories = await getAllStoriesAdmin(status);
  const chapterCounts = await getStoryChapterCounts(stories.map((s) => s.id));

  return (
    <div>
      <AdminHeader title={t.admin.stories} />
      <div className="px-8.5 pb-15 pt-7">
        <div className="rounded-[22px] border border-border bg-card p-6.5">
          <div className="mb-5 flex gap-2">
            {[undefined, "published", "draft", "unlisted"].map((s) => (
              <Link key={s ?? "all"} href={s ? `?status=${s}` : "?"}>
                <Chip active={status === s || (!status && !s)}>{s ?? t.common.all}</Chip>
              </Link>
            ))}
          </div>

          <div className="mb-3 flex items-center gap-4 border-b border-border-soft pb-3 text-[12px] font-bold uppercase tracking-wide text-muted-2">
            <span className="flex-[1.6]">История</span>
            <span className="flex-1">Автор</span>
            <span className="w-25">Главы</span>
            <span className="w-27.5">Просмотры</span>
            <span className="w-32.5">Статус</span>
          </div>

          {stories.map((s) => {
            const author = s.author as unknown as { display_name: string } | null;
            return (
              <Link
                key={s.id}
                href={ROUTES.story(s.slug)}
                className="flex items-center gap-4 border-b border-border-soft py-3.5 last:border-0 hover:bg-surface"
              >
                <span className="flex-[1.6] truncate text-[14.5px] font-bold">{s.title}</span>
                <span className="flex-1 text-[13.5px] text-ink-soft">{author?.display_name}</span>
                <span className="w-25 text-[13.5px] text-ink-soft">{chapterCounts[s.id] ?? 0}</span>
                <span className="w-27.5 text-[13.5px] text-ink-soft">{s.view_count}</span>
                <span className="w-32.5">
                  <Badge tone={s.status === "published" ? "success" : "neutral"}>{s.status}</Badge>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
