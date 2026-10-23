import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";
import type { ForumPostItem } from "@/server/data/forum";
import type { ForumCategory } from "@/types/database";
import { formatRelativeTime } from "@/lib/format";
import { plural } from "@/lib/plural";
import { ROUTES } from "@/lib/constants";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Chip";
import { CommentsIcon, LockIcon } from "@/components/ui/icons";
import { VoteButton } from "@/components/forum/VoteButton";

const CATEGORY_TONE: Record<ForumCategory, "primary" | "pink" | "success" | "warning" | "neutral"> = {
  muhokama: "primary",
  maslahat: "success",
  tavsiya: "pink",
  sorov: "warning",
  elon: "neutral",
};

export function CategoryBadge({ category, t }: { category: ForumCategory; t: Dictionary }) {
  return <Badge tone={CATEGORY_TONE[category]}>{t.forum.categories[category]}</Badge>;
}

// «Dilnoza mavzuda javob berdi» / «Dilnoza va yana 2 kishi …» — only
// people the viewer actually follows (see listForumPosts).
function FollowedRepliers({ people, t }: { people: ForumPostItem["followedRepliers"]; t: Dictionary }) {
  if (people.length === 0) return null;
  const [first, ...rest] = people;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-primary-800">
      <Avatar name={first.display_name} size={18} />
      <span className="truncate">
        <b>{first.display_name}</b>{" "}
        {rest.length > 0 ? t.forum.followedRepliedMany.replace("{count}", String(rest.length)) : t.forum.followedReplied}
      </span>
    </span>
  );
}

export function PostCard({
  post,
  t,
  locale,
  voteState,
  showCategory = true,
}: {
  post: ForumPostItem;
  t: Dictionary;
  locale: string;
  voteState: "can" | "guest" | "own" | "blocked";
  showCategory?: boolean;
}) {
  const href = ROUTES.forumPost(post.id);
  return (
    <article className={`flex gap-3 rounded-[14px] border bg-card p-3.5 sm:gap-4 sm:p-5 ${post.is_pinned ? "border-primary-200" : "border-border"}`}>
      <VoteButton postId={post.id} voted={post.votedByMe} count={post.vote_count} state={voteState} />
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-2">
          {post.is_pinned && <Badge tone="primary">📌 {t.forum.pinned}</Badge>}
          {showCategory && <CategoryBadge category={post.category} t={t} />}
          {post.is_locked && (
            <span className="inline-flex items-center gap-1 font-semibold" title={t.forum.lockedNotice}>
              <LockIcon width={13} height={13} />
              {t.forum.locked}
            </span>
          )}
          {post.hidden && <Badge tone="danger">{t.forum.hiddenBadge}</Badge>}
          <Link prefetch={false} href={ROUTES.author(post.author.username)} className="flex min-w-0 items-center gap-1.5 font-semibold text-ink-soft hover:text-primary-800">
            <Avatar name={post.author.display_name} src={post.author.avatar_url} size={20} />
            <span className="truncate">{post.author.display_name}</span>
          </Link>
          <span>· {formatRelativeTime(post.created_at, locale)}</span>
        </div>

        <Link prefetch={false} href={href} className="block">
          <h3 className="mb-1 break-words text-[16px] font-extrabold leading-snug hover:text-primary-800 sm:text-[17px]">{post.title}</h3>
          {post.body && <p className="line-clamp-3 whitespace-pre-line break-words text-[14px] leading-relaxed text-ink-soft">{post.body}</p>}
        </Link>

        {post.story && (
          <Link
            prefetch={false}
            href={ROUTES.story(post.story.slug)}
            className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-[9px] bg-surface px-2.5 py-1.5 text-[12.5px] font-bold text-primary-800 hover:bg-primary-50"
          >
            📖 <span className="truncate">{post.story.title}</span>
          </Link>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <Link prefetch={false} href={`${href}#izohlar`} className="flex items-center gap-1.5 text-[13px] font-bold text-muted-2 hover:text-primary-800">
            <CommentsIcon width={16} height={16} />
            {post.comment_count} {plural(post.comment_count, t.forum.commentsCount)}
          </Link>
          <FollowedRepliers people={post.followedRepliers} t={t} />
        </div>
      </div>
    </article>
  );
}

export function voteStateFor(
  viewer: { id: string; status: string } | null,
  authorId: string
): "can" | "guest" | "own" | "blocked" {
  if (!viewer) return "guest";
  if (viewer.id === authorId) return "own";
  if (viewer.status !== "active") return "blocked";
  return "can";
}
