"use client";

import Image from "next/image";
import { ImageZoom } from "@/components/story/ImageZoom";

// The cover is its own click target, separate from the card's Link (which
// only wraps the title/author/stats below it) — clicking the image opens a
// full-size preview instead of navigating away, clicking the text still
// goes to the story.
export function StoryCoverZoom({
  coverUrl,
  title,
  authorName,
  topRightBadge,
}: {
  coverUrl: string | null;
  title: string;
  authorName?: string;
  topRightBadge?: React.ReactNode;
}) {
  if (!coverUrl) {
    return (
      <div className="relative flex aspect-[3/4] items-center justify-center bg-primary-200 p-3">
        <div className="text-center">
          <div className="line-clamp-4 text-[12.5px] font-extrabold leading-snug text-primary-900">{title}</div>
          {authorName && (
            <div className="mt-1.5 truncate text-[10.5px] font-semibold text-primary-800/80">{authorName}</div>
          )}
        </div>
        {topRightBadge}
      </div>
    );
  }

  return (
    <ImageZoom
      src={coverUrl}
      alt={title}
      triggerClassName="relative flex aspect-[3/4] w-full cursor-zoom-in items-center justify-center bg-primary-200 p-3"
    >
      <Image src={coverUrl} alt="" fill sizes="(max-width: 1023px) 25vw, 12.5vw" className="object-cover" />
      {topRightBadge}
    </ImageZoom>
  );
}
