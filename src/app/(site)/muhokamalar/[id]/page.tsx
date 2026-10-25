import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { getAuthorStories } from "@/lib/queries/stories";
import { getDb } from "@/server/db/client";
import { getForumPost, listForumComments } from "@/server/data/forum";
import { canCommentOnForumPost, isStaff, type Viewer } from "@/server/authz/policy";
import { formatDateTime } from "@/lib/format";
import { plural } from "@/lib/plural";
import { ROUTES } from "@/lib/constants";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Chip";
import { LinkChip } from "@/components/ui/LinkChip";
import { LockIcon } from "@/components/ui/icons";
import { CategoryBadge, voteStateFor } from "@/components/forum/PostCard";
import { VoteButton } from "@/components/forum/VoteButton";
import { PostActions } from "@/components/forum/PostActions";
import { ForumComments } from "@/components/forum/ForumComments";

async function loadViewer(): Promise<Viewer | null> {
  const user = await getCurrentUser();
  return user?.profile ? { id: user.id, role: user.profile.role, status: user.profile.status } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const viewer = await loadViewer();
  const post = await Promise.resolve().then(() => getForumPost(getDb(), viewer, id)).catch(() => null);
  if (!post) return {};
  return { title: post.title, description: post.body.slice(0, 160) || undefined };
}

export default async function ForumPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const [{ id }, { sort: rawSort }] = await Promise.all([params, searchParams]);
  const sort = rawSort === "new" ? "new" : "best";
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const viewer = await loadViewer();
  const db = getDb();

  const post = await getForumPost(db, viewer, id);
  if (!post) notFound();

  const postRecord = { id: post.id, author_id: post.author.id, is_locked: post.is_locked, hidden_at: post.hidden ? post.created_at : null };
  const canComment = canCommentOnForumPost(viewer, postRecord);
  const [comments, myStories] = await Promise.all([
    listForumComments(db, viewer, post.id, sort),
    // In a «Soʻrov» an author may answer with one of their published stories.
    post.category === "sorov" && viewer && canComment ? getAuthorStories(viewer.id, false) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-200">
      <Link prefetch={false} href={ROUTES.forum} className="mb-4 inline-block text-[13.5px] font-bold text-primary-800 hover:underline">
        ← {t.forum.backToList}
      </Link>

      <article className="bezel mx-2 mb-8 flex gap-3 rounded-[20px] p-4 sm:mx-0 sm:gap-4 sm:p-6">
        <VoteButton postId={post.id} voted={post.votedByMe} count={post.vote_count} state={voteStateFor(viewer, post.author.id)} />
        <div className="min-w-0 flex-1">
          <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12.5px] text-muted-2">
            {post.is_pinned && <Badge tone="primary">📌 {t.forum.pinned}</Badge>}
            <CategoryBadge category={post.category} t={t} />
            {post.is_locked && (
              <span className="inline-flex items-center gap-1 font-semibold">
                <LockIcon width={13} height={13} />
                {t.forum.locked}
              </span>
            )}
            {post.hidden && <Badge tone="danger">{t.forum.hiddenBadge}</Badge>}
          </div>

          <h1 className="mb-3 break-words text-[21px] font-extrabold leading-snug tracking-tight sm:text-[26px]">{post.title}</h1>

          <Link prefetch={false} href={ROUTES.author(post.author.username)} className="mb-4 flex w-fit items-center gap-2.5 hover:text-primary-800">
            <Avatar name={post.author.display_name} src={post.author.avatar_url} size={34} />
            <span>
              <span className="block text-[14px] font-bold leading-tight">{post.author.display_name}</span>
              <span className="block text-[12px] text-muted-3">{formatDateTime(post.created_at, locale)}</span>
            </span>
          </Link>

          {post.body && <p className="mb-4 whitespace-pre-line break-words text-[15px] leading-relaxed text-ink-soft">{post.body}</p>}

          {post.story && (
            <Link
              prefetch={false}
              href={ROUTES.story(post.story.slug)}
              className="mb-4 flex max-w-full items-center gap-2 rounded-[12px] border border-border-soft bg-surface px-3.5 py-3 text-[14px] font-bold text-primary-800 hover:bg-primary-50"
            >
              📖 <span className="truncate">{post.story.title}</span>
            </Link>
          )}

          <PostActions
            postId={post.id}
            own={viewer?.id === post.author.id}
            isStaff={isStaff(viewer)}
            signedIn={Boolean(viewer)}
            isPinned={post.is_pinned}
            isLocked={post.is_locked}
            hidden={post.hidden}
          />
        </div>
      </article>

      <div id="izohlar" className="mb-4 flex scroll-mt-28 flex-wrap items-center gap-3">
        <h2 className="mr-auto text-[19px] font-extrabold tracking-tight">
          {t.forum.commentsTitle}{" "}
          <span className="text-[15px] font-bold text-muted-2">
            {post.comment_count} {plural(post.comment_count, t.forum.commentsCount)}
          </span>
        </h2>
        <LinkChip href={`${ROUTES.forumPost(post.id)}#izohlar`} active={sort === "best"} shrink scroll={false}>
          {t.forum.sortBest}
        </LinkChip>
        <LinkChip href={`${ROUTES.forumPost(post.id)}?sort=new#izohlar`} active={sort === "new"} shrink scroll={false}>
          {t.forum.sortNewest}
        </LinkChip>
      </div>

      <ForumComments
        postId={post.id}
        postAuthorId={post.author.id}
        comments={comments}
        locked={post.is_locked}
        canComment={canComment}
        viewer={viewer ? { id: viewer.id, isStaff: isStaff(viewer), active: viewer.status === "active" } : null}
        myStories={myStories.map((s) => ({ id: s.id, title: s.title }))}
      />
    </div>
  );
}
