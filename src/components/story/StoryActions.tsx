"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import Link from "next/link";
import { toggleStoryLike, toggleStoryBookmark, toggleFollowAuthor } from "@/lib/actions/social";
import { toggleStoryInCollection, createCollectionWithStory } from "@/lib/actions/collections";
import { setReadingStatus } from "@/lib/actions/reading";
import { HeartIcon, BookmarkIcon, CollectionsIcon, ChevronDownIcon } from "@/components/ui/icons";
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
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card text-[13.5px] font-bold text-ink-soft"
        >
          <HeartIcon />
          <span>{t.common.like}</span>
        </Link>
        <Link
          href={ROUTES.onboarding}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card text-[13.5px] font-bold text-ink-soft"
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
          liked ? "border-primary-300 bg-primary-50 text-primary-900" : "border-border bg-card text-ink-soft"
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
            : "border-border bg-card text-ink-soft"
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
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Creating a collection from here means the intent is "put this story in
  // a new collection" — so it's added in the same request, and the picker
  // stays open with the new collection already checked, same as YouTube's
  // "Save to playlist" → "Create new playlist" flow.
  function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    setCreateError(null);
    startTransition(async () => {
      const result = await createCollectionWithStory(storyId, title, path);
      if ("error" in result) {
        setCreateError(t.story.newCollectionError);
        return;
      }
      setItems((prev) => [{ id: result.id, title: result.title, hasStory: true }, ...prev]);
      setNewTitle("");
      setCreating(false);
    });
  }

  if (!isAuthenticated) {
    return (
      <Link
        href={ROUTES.onboarding}
        title={t.story.addToCollection}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-ink-soft"
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
          open ? "border-primary-300 bg-primary-50 text-primary-900" : "border-border bg-card text-ink-soft"
        )}
      >
        <CollectionsIcon />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-64 max-h-72 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-[0_14px_30px_rgba(60,40,120,0.14)]">
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
                    c.hasStory ? "border-[#9333EA] bg-[#9333EA]" : "border-border-soft bg-card"
                  )}
                >
                  {c.hasStory && "✓"}
                </span>
                <span className="truncate">{c.title}</span>
              </button>
            ))
          ) : (
            !creating && <p className="px-3 py-2.5 text-[13px] text-muted-2">{t.story.noCollectionsYet}</p>
          )}

          {creating ? (
            <div className="mt-1 flex items-center gap-1.5 px-1 py-1">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreate();
                  }
                  if (e.key === "Escape") setCreating(false);
                }}
                placeholder={t.collections.createTitlePlaceholder}
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 text-[13px] text-ink outline-none focus:border-primary-500"
              />
              <button
                type="button"
                onClick={handleCreate}
                className="shrink-0 cursor-pointer rounded-lg bg-[#6D28D9] px-2.5 py-2 text-[12.5px] font-bold text-white"
              >
                {t.story.newCollectionConfirm}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-1 block w-full cursor-pointer rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-primary-800 hover:bg-surface"
            >
              + {t.library.createCollection}
            </button>
          )}
          {createError && <p className="mt-1 px-3 text-[12px] text-danger">{createError}</p>}
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
  const [status, setStatus] = useState<ReadingStatus | null>(initialStatus);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const options: { value: ReadingStatus | null; label: string }[] = [
    { value: null, label: t.story.readingStatusNone },
    { value: "want_to_read", label: t.story.readingStatusWantToRead },
    { value: "read", label: t.story.readingStatusRead },
    { value: "dropped", label: t.story.readingStatusDropped },
  ];
  const current = options.find((o) => o.value === status) ?? options[0];

  function choose(value: ReadingStatus | null) {
    setStatus(value);
    setOpen(false);
    startTransition(() => setReadingStatus(storyId, value, path));
  }

  return (
    <div ref={ref} className="relative mb-4.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex h-11 w-full cursor-pointer items-center justify-between rounded-xl border px-3.5 text-[13.5px] font-bold transition",
          status ? "border-primary-300 bg-primary-50 text-primary-900" : "border-border bg-card text-ink-soft"
        )}
      >
        <span>{current.label}</span>
        <ChevronDownIcon className={clsx("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-[0_14px_30px_rgba(60,40,120,0.14)]">
          {options.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => choose(o.value)}
              className={clsx(
                "flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13.5px] hover:bg-surface",
                status === o.value ? "font-bold text-primary-900" : "text-ink-soft"
              )}
            >
              <span>{o.label}</span>
              {status === o.value && <span className="text-primary-600">✓</span>}
            </button>
          ))}
        </div>
      )}
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
        following ? "border-border bg-card text-ink-soft" : "border-primary-200 bg-primary-50 text-primary-900"
      )}
    >
      {content}
    </button>
  );
}
