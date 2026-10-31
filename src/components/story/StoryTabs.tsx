"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { LockIcon } from "@/components/ui/icons";
import { CommentGuidelines } from "@/components/story/CommentGuidelines";
import { CommentForm } from "@/components/story/CommentForm";
import { StoryCommentCard } from "@/components/story/StoryCommentCard";
import { ROUTES } from "@/lib/constants";
import { fetchStoryComments } from "@/lib/actions/social";
import type { StoryCommentThread } from "@/lib/queries/social";

// Chapters <-> Comments as a real client-side tab switch: instant, no page
// navigation and no loading skeleton (the old `?tab=` links re-rendered the
// whole story page on the server, which read as a full reload). Comments are
// lazy — the query runs only when a reader first opens the tab, and again right
// after they post one, so a new comment shows immediately. Chapters are rendered
// on the server and handed in as `chapters`, so none of that markup/logic (locks,
// read marks, paywall) changes — it's just toggled, staying mounted.
export function StoryTabs({
  storyId,
  slug,
  path,
  isLoggedIn,
  isBlocked,
  viewerId,
  chaptersCount,
  initialCommentsCount,
  chapters,
}: {
  storyId: string;
  slug: string;
  path: string;
  isLoggedIn: boolean;
  isBlocked: boolean;
  viewerId: string | null;
  chaptersCount: number;
  initialCommentsCount: number;
  chapters: ReactNode;
}) {
  const { t } = useLocale();
  const [tab, setTab] = useState<"chapters" | "comments">("chapters");
  const [comments, setComments] = useState<StoryCommentThread[] | null>(null);
  const [count, setCount] = useState(initialCommentsCount);
  const [loading, startTransition] = useTransition();

  function reload() {
    startTransition(async () => {
      setComments(await fetchStoryComments(storyId));
    });
  }

  function openComments() {
    setTab("comments");
    if (comments === null && !loading) reload();
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2.5 overflow-x-auto">
        <Chip type="button" active={tab === "chapters"} onClick={() => setTab("chapters")} className="shrink-0 whitespace-nowrap">
          {t.story.chapters} <span className="ml-1 opacity-70">{chaptersCount}</span>
        </Chip>
        <Chip type="button" active={tab === "comments"} onClick={openComments} className="shrink-0 whitespace-nowrap">
          {t.common.comments} <span className="ml-1 opacity-70">{count}</span>
        </Chip>
      </div>

      {/* Chapters stay mounted (just hidden) so switching back is instant. */}
      <div className={tab === "chapters" ? "" : "hidden"}>{chapters}</div>

      <div className={tab === "comments" ? "flex flex-col gap-3.5" : "hidden"}>
        {isLoggedIn ? (
          <div className="mb-1.5">
            <CommentGuidelines />
            <CommentForm
              storyId={storyId}
              chapterId={null}
              path={path}
              blocked={isBlocked}
              onSuccess={() => {
                setCount((c) => c + 1);
                reload();
              }}
            />
          </div>
        ) : (
          <div className="mb-1.5 flex flex-wrap items-center gap-3 rounded-[12px] border border-dashed border-primary-300 bg-card px-5 py-4">
            <LockIcon className="text-muted-2" />
            <span className="text-[14px] text-ink-soft">{t.reader.commentsLocked}</span>
            <Link prefetch={false} href={ROUTES.onboarding} className="ml-auto">
              <Button size="sm">{t.common.login}</Button>
            </Link>
          </div>
        )}

        {comments === null ? (
          <div className="rounded-[14px] border border-border bg-card px-6 py-10 text-center text-[14px] text-muted-2">
            {t.common.loading}
          </div>
        ) : comments.length > 0 ? (
          comments.map((c) => (
            <div key={c.id} className="flex flex-col gap-2.5">
              <StoryCommentCard comment={c} slug={slug} viewerId={viewerId} />
              {c.replies.length > 0 && (
                <div className="ml-10.5 flex flex-col gap-2.5">
                  {c.replies.map((r) => (
                    <StoryCommentCard key={r.id} comment={r} slug={slug} isReply viewerId={viewerId} />
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-[14px] border border-border bg-card px-6 py-10 text-center text-[14px] text-muted-2">
            {t.story.noCommentsYet}
          </div>
        )}
      </div>
    </>
  );
}
