"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import Link from "next/link";
import { toggleStoryLike, toggleStoryBookmark, toggleFollowAuthor } from "@/lib/actions/social";
import { toggleStoryInCollection } from "@/lib/actions/collections";
import { setReadingStatus } from "@/lib/actions/reading";
import { HeartIcon, BookmarkIcon, CollectionsIcon } from "@/components/ui/icons";
import { ROUTES } from "@/lib/constants";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { ReadingStatus } from "@/types/database";
import type { CollectionPickerItem } from "@/lib/queries/stories";

export function LikeBookmarkRow({
  storyId,
  isAuthenticated,
  initialLiked,
  initialBookmarked,
  collections,
  path,
}: {
  storyId: string;
  isAuthenticated: boolean;
  initialLiked: boolean;
  initialBookmarked: boolean;
  collections: CollectionPickerItem[];
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
        <CollectionPickerButton storyId={storyId} isAuthenticated={false} collections={collections} path={path} />
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
      <CollectionPickerButton storyId={storyId} isAuthenticated collections={collections} path={path} />
    </div>
  );
}

function CollectionPickerButton({
  storyId,
  isAuthenticated,
  collections,
  path,
}: {
  storyId: string;
  isAuthenticated: boolean;
  collections: CollectionPickerItem[];
  path: string;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(collections);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!isAuthenticated) {
    return (
      <Link
        href={ROUTES.onboarding}
        title={t.story.addToCollection}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-ink-soft"
      >
        <CollectionsIcon />
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        title={t.story.addToCollection}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border transition",
          open ? "border-primary-300 bg-primary-50 text-primary-900" : "border-border bg-white text-ink-soft"
        )}
      >
        <CollectionsIcon />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-64 max-h-72 overflow-y-auto rounded-2xl border border-border bg-white p-2 shadow-[0_14px_30px_rgba(60,40,120,0.14)]">
          {items.length > 0 ? (
            items.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, hasStory: !x.hasStory } : x)));
                  startTransition(() => toggleStoryInCollection(c.id, storyId, path));
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] hover:bg-surface"
              >
                <span
                  className={clsx(
                    "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-[5px] border text-[10px] text-white",
                    c.hasStory ? "border-primary-600 bg-primary-600" : "border-border-soft bg-white"
                  )}
                >
                  {c.hasStory && "✓"}
                </span>
                <span className="truncate">{c.title}</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2.5 text-[13px] text-muted-2">{t.story.noCollectionsYet}</p>
          )}
          <Link
            href={`${ROUTES.collections}?create=1`}
            className="mt-1 block rounded-xl px-3 py-2.5 text-[13px] font-bold text-primary-800 hover:bg-surface"
          >
            + {t.library.createCollection}
          </Link>
        </div>
      )}
    </div>
  );
}

export function ReadingStatusSelect({
  storyId,
  initialStatus,
  path,
}: {
  storyId: string;
  initialStatus: ReadingStatus | null;
  path: string;
}) {
  const { t } = useLocale();
  const [status, setStatus] = useState<ReadingStatus | "">(initialStatus ?? "");
  const [, startTransition] = useTransition();

  return (
    <select
      value={status}
      onChange={(e) => {
        const value = e.target.value as ReadingStatus | "";
        setStatus(value);
        startTransition(() => setReadingStatus(storyId, value || null, path));
      }}
      className="mb-4.5 h-11 w-full cursor-pointer rounded-xl border border-border bg-white px-3.5 text-[13.5px] font-bold text-ink-soft outline-none"
    >
      <option value="">{t.story.readingStatusNone}</option>
      <option value="want_to_read">{t.story.readingStatusWantToRead}</option>
      <option value="read">{t.story.readingStatusRead}</option>
      <option value="dropped">{t.story.readingStatusDropped}</option>
    </select>
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
