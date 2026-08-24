"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import Link from "next/link";
import { toggleStoryLike, toggleStoryBookmark, toggleFollowAuthor } from "@/lib/actions/social";
import { HeartIcon, BookmarkIcon } from "@/components/ui/icons";
import { ROUTES } from "@/lib/constants";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function LikeBookmarkRow({
  storyId,
  isAuthenticated,
  initialLiked,
  initialBookmarked,
  path,
}: {
  storyId: string;
  isAuthenticated: boolean;
  initialLiked: boolean;
  initialBookmarked: boolean;
  path: string;
}) {
  const { t } = useLocale();
  const [liked, setLiked] = useState(initialLiked);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [, startTransition] = useTransition();

  if (!isAuthenticated) {
    return (
      <div className="mb-4.5 flex gap-2.5">
        <Link
          href={ROUTES.onboarding}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-white text-[13.5px] font-bold text-ink-soft"
        >
          <HeartIcon />
          <span>{t.common.like}</span>
        </Link>
        <Link
          href={ROUTES.onboarding}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-white text-[13.5px] font-bold text-ink-soft"
        >
          <BookmarkIcon />
          <span>{t.common.bookmark}</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-4.5 flex gap-2.5">
      <button
        type="button"
        onClick={() => {
          setLiked((v) => !v);
          startTransition(() => toggleStoryLike(storyId, path));
        }}
        className={clsx(
          "flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border text-[13.5px] font-bold transition",
          liked ? "border-primary-300 bg-primary-50 text-primary-900" : "border-border bg-white text-ink-soft"
        )}
      >
        <HeartIcon filled={liked} className={liked ? "text-primary-600" : undefined} />
        <span>{liked ? t.common.liked : t.common.like}</span>
      </button>
      <button
        type="button"
        onClick={() => {
          setBookmarked((v) => !v);
          startTransition(() => toggleStoryBookmark(storyId, path));
        }}
        className={clsx(
          "flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border text-[13.5px] font-bold transition",
          bookmarked
            ? "border-primary-300 bg-primary-50 text-primary-900"
            : "border-border bg-white text-ink-soft"
        )}
      >
        <BookmarkIcon filled={bookmarked} className={bookmarked ? "text-primary-600" : undefined} />
        <span>{bookmarked ? t.common.bookmarked : t.common.bookmark}</span>
      </button>
    </div>
  );
}

export function FollowButton({
  authorId,
  isAuthenticated,
  initialFollowing,
  path,
}: {
  authorId: string;
  isAuthenticated: boolean;
  initialFollowing: boolean;
  path: string;
}) {
  const { t } = useLocale();
  const [following, setFollowing] = useState(initialFollowing);
  const [, startTransition] = useTransition();

  const content = following ? t.common.subscribed : t.story.subscribe;

  if (!isAuthenticated) {
    return (
      <Link
        href={ROUTES.onboarding}
        className="flex h-10.5 w-full items-center justify-center rounded-xl border border-primary-200 bg-primary-50 text-[14px] font-bold text-primary-900"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setFollowing((v) => !v);
        startTransition(() => toggleFollowAuthor(authorId, path));
      }}
      className={clsx(
        "flex h-10.5 w-full cursor-pointer items-center justify-center rounded-xl border text-[14px] font-bold transition",
        following ? "border-border bg-white text-ink-soft" : "border-primary-200 bg-primary-50 text-primary-900"
      )}
    >
      {content}
    </button>
  );
}
