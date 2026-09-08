import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getAllCommentsAdmin, type AdminCommentRow } from "@/lib/queries/admin";
import { formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/constants";
import { AdminHeader } from "../AdminHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 24;

export default async function AdminCommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  const { threads, total } = await getAllCommentsAdmin(page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <AdminHeader title={t.admin.comments} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        {threads.length > 0 ? (
          <div className="flex flex-col gap-4">
            {threads.map((c) => (
              <div key={c.id} className="rounded-[12px] border border-border bg-card p-4.5 sm:p-5.5">
                <CommentMeta comment={c} locale={locale} t={t} />

                {c.replies.length > 0 && (
                  <div className="ml-9.5 mt-3.5 flex flex-col gap-3 border-l-2 border-border-soft pl-4">
                    {c.replies.map((r) => (
                      <CommentMeta key={r.id} comment={r} locale={locale} t={t} isReply />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[12px] border border-dashed border-border-soft bg-surface px-6 py-14 text-center text-[14px] text-muted">
            {t.admin.noCommentsYet}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} buildHref={(p) => `${ROUTES.adminComments}?page=${p}`} />
      </div>
    </div>
  );
}

function CommentMeta({
  comment,
  locale,
  t,
  isReply,
}: {
  comment: AdminCommentRow;
  locale: string;
  t: ReturnType<typeof getDictionary>;
  isReply?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <Avatar name={comment.user?.display_name ?? "?"} size={isReply ? 30 : 38} />
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-[14px] font-bold">{comment.user?.display_name}</span>
          {comment.user?.username && <span className="text-[12.5px] text-muted-3">@{comment.user.username}</span>}
          <span className="text-[12.5px] text-muted-3">{formatDateTime(comment.created_at, locale)}</span>
        </div>

        {!isReply && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {comment.story && (
              <Link
                href={ROUTES.adminStory(comment.story.id)}
                className="rounded-full bg-primary-50 px-2.5 py-1 text-[12px] font-bold text-primary-800 hover:bg-primary-100"
              >
                {comment.story.title}
              </Link>
            )}
            {comment.story && comment.chapter ? (
              <Link
                href={ROUTES.adminChapter(comment.story.id, comment.chapter.id)}
                className="rounded-full bg-surface px-2.5 py-1 text-[12px] font-semibold text-ink-soft hover:bg-border-soft"
              >
                {t.admin.colChapter} {comment.chapter.order_index}: {comment.chapter.title}
              </Link>
            ) : (
              <span className="rounded-full bg-surface px-2.5 py-1 text-[12px] font-semibold text-muted-2">
                {t.admin.generalComment}
              </span>
            )}
            {comment.is_spoiler && (
              <span className="rounded-full bg-danger-bg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-danger">
                {t.reader.spoilerBadge}
              </span>
            )}
          </div>
        )}

        <p className="text-[14px] leading-relaxed text-ink-soft">{comment.text}</p>
      </div>
    </div>
  );
}
