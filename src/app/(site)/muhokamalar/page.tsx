import Link from "next/link";
import type { Metadata } from "next";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/server/db/client";
import { logQueryError } from "@/lib/queries/query-errors";
import {
  FORUM_CATEGORIES,
  FORUM_PAGE_SIZE,
  isForumCategory,
  listForumPosts,
  type ForumPeriod,
  type ForumPostItem,
  type ForumSort,
} from "@/server/data/forum";
import type { Viewer } from "@/server/authz/policy";
import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { LinkChip } from "@/components/ui/LinkChip";
import { Pagination } from "@/components/ui/Pagination";
import { PostCard, voteStateFor } from "@/components/forum/PostCard";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getServerLocale());
  return { title: t.forum.title, description: t.forum.body };
}

const SORTS: ForumSort[] = ["hot", "new", "top"];
const PERIODS: ForumPeriod[] = ["week", "month", "all"];

export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string; period?: string; page?: string }>;
}) {
  const params = await searchParams;
  const category = isForumCategory(params.category) ? params.category : undefined;
  const sort: ForumSort = SORTS.includes(params.sort as ForumSort) ? (params.sort as ForumSort) : "hot";
  const period: ForumPeriod = PERIODS.includes(params.period as ForumPeriod) ? (params.period as ForumPeriod) : "week";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const user = await getCurrentUser();
  const viewer: Viewer | null = user?.profile ? { id: user.id, role: user.profile.role, status: user.profile.status } : null;

  let posts: ForumPostItem[] = [];
  let total = 0;
  try {
    ({ posts, total } = await listForumPosts(getDb(), viewer, { category, sort, period, page }));
  } catch (err) {
    logQueryError("listForumPosts", err);
  }
  const totalPages = Math.max(1, Math.ceil(total / FORUM_PAGE_SIZE));

  function href(next: { category?: string | null; sort?: ForumSort; period?: ForumPeriod; page?: number }) {
    const q = new URLSearchParams();
    const c = next.category === null ? undefined : (next.category ?? category);
    const s = next.sort ?? sort;
    if (c) q.set("category", c);
    if (s !== "hot") q.set("sort", s);
    if (s === "top") {
      const p = next.period ?? period;
      if (p !== "week") q.set("period", p);
    }
    if (next.page && next.page > 1) q.set("page", String(next.page));
    const qs = q.toString();
    return qs ? `${ROUTES.forum}?${qs}` : ROUTES.forum;
  }

  const sortLabels: Record<ForumSort, string> = { hot: t.forum.sortHot, new: t.forum.sortNew, top: t.forum.sortTop };
  const periodLabels: Record<ForumPeriod, string> = { week: t.forum.periodWeek, month: t.forum.periodMonth, all: t.forum.periodAll };

  return (
    <div className="mx-auto max-w-200">
      <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:gap-6">
        <div className="flex-1">
          <h1 className="mb-2 text-[26px] font-extrabold tracking-tight sm:text-[32px]">{t.forum.title}</h1>
          <p className="max-w-160 text-[15px] leading-relaxed text-muted">{t.forum.body}</p>
        </div>
        <Link prefetch={false} href={user ? `${ROUTES.forumNew}${category ? `?category=${category}` : ""}` : ROUTES.onboarding} className="w-full shrink-0 sm:w-auto">
          <Button size="lg" className="w-full justify-center sm:w-auto">
            {t.forum.newTopic}
          </Button>
        </Link>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        <LinkChip href={href({ category: null, page: 1 })} active={!category} shrink>
          {t.forum.all}
        </LinkChip>
        {FORUM_CATEGORIES.map((c) => (
          <LinkChip key={c} href={href({ category: c, page: 1 })} active={category === c} shrink>
            {t.forum.categories[c]}
          </LinkChip>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {SORTS.map((s) => (
          <LinkChip key={s} href={href({ sort: s, page: 1 })} active={sort === s} shrink>
            {sortLabels[s]}
          </LinkChip>
        ))}
        {sort === "top" && (
          <span className="ml-1 flex flex-wrap gap-1.5 border-l border-border-soft pl-3">
            {PERIODS.map((p) => (
              <LinkChip key={p} href={href({ period: p, page: 1 })} active={period === p} shrink className="h-8 text-[12.5px]">
                {periodLabels[p]}
              </LinkChip>
            ))}
          </span>
        )}
      </div>

      {category && <p className="mb-4 text-[13.5px] text-muted-2">{t.forum.categoryHints[category]}</p>}

      {posts.length > 0 ? (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              t={t}
              locale={locale}
              voteState={voteStateFor(viewer, post.author.id)}
              showCategory={!category}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state rounded-[18px] border border-dashed border-border bg-card/60 px-6 py-14 text-center text-[14px] text-muted">
          {t.forum.empty}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} buildHref={(p) => href({ page: p })} />
    </div>
  );
}
