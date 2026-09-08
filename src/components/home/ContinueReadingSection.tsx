"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/lib/constants";
import { CloseIcon } from "@/components/ui/icons";

type ContinueReadingItem = {
  percent: number;
  story: { id: string; title: string; slug: string; cover_url: string | null } | null;
};

// The × next to the heading only hides the section for this page view
// (plain client state, nothing persisted) — a refresh or the next visit
// brings it right back.
export function ContinueReadingSection({
  items,
  title,
  hideLabel,
}: {
  items: ContinueReadingItem[];
  title: string;
  hideLabel: string;
}) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <>
      <div className="mb-4.5 flex items-center gap-3.5">
        <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label={hideLabel}
          title={hideLabel}
          className="ml-auto flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-2 transition hover:bg-surface hover:text-ink-soft"
        >
          <CloseIcon width={16} height={16} />
        </button>
      </div>
      <div className="mb-11 grid grid-cols-1 gap-4.5 xs:grid-cols-2 sm:grid-cols-3">
        {items.map((item, i) => {
          const story = item.story;
          if (!story) return null;
          return (
            <Link
              key={i}
              href={ROUTES.story(story.slug)}
              className="flex gap-3.5 rounded-2xl border border-border bg-card p-3.5 hover:border-primary-300"
            >
              <div className="relative h-21 w-21 shrink-0 overflow-hidden rounded-[13px] bg-primary-200">
                {story.cover_url && (
                  <Image src={story.cover_url} alt="" fill sizes="84px" className="object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="mb-1.5 line-clamp-2 text-[15px] font-bold leading-tight">{story.title}</h3>
                <div className="h-2 w-full max-w-30 overflow-hidden rounded-full bg-border-soft">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-primary-700 to-primary-500"
                    style={{ width: `${Math.min(100, Math.round(item.percent))}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
