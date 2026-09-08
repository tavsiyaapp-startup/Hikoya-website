"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { CloseIcon } from "@/components/ui/icons";

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
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <>
      {coverUrl ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label={title}
          className="relative flex aspect-[3/4] w-full cursor-zoom-in items-center justify-center bg-primary-200 p-3"
        >
          <Image src={coverUrl} alt="" fill sizes="(max-width: 1023px) 25vw, 12.5vw" className="object-cover" />
          {topRightBadge}
        </button>
      ) : (
        <div className="relative flex aspect-[3/4] items-center justify-center bg-primary-200 p-3">
          <div className="text-center">
            <div className="line-clamp-4 text-[12.5px] font-extrabold leading-snug text-primary-900">{title}</div>
            {authorName && (
              <div className="mt-1.5 truncate text-[10.5px] font-semibold text-primary-800/80">{authorName}</div>
            )}
          </div>
          {topRightBadge}
        </div>
      )}

      {open && coverUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t.common.close}
            className="absolute right-4 top-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <CloseIcon width={20} height={20} />
          </button>
          <div
            className="relative aspect-[3/4] max-h-[85vh] w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <Image src={coverUrl} alt="" fill sizes="90vw" className="rounded-[12px] object-contain" />
          </div>
        </div>
      )}
    </>
  );
}
