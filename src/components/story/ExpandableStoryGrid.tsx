"use client";

import { Children, useState } from "react";

const MOBILE_VISIBLE_COUNT = 12;

// Server-fetches enough for 3 full desktop rows (24 = 8 cols × 3), but on
// mobile/tablet (below the lg 8-col breakpoint) only the first 12 show
// until "Показать ещё" is tapped — no extra network round trip, the rest
// were already fetched and are just sitting there with `hidden` on them.
// Desktop always shows everything server sent, no button needed there.
export function ExpandableStoryGrid({
  children,
  showMoreLabel,
}: {
  children: React.ReactNode;
  showMoreLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = Children.toArray(children);
  const hasMore = items.length > MOBILE_VISIBLE_COUNT;

  return (
    <>
      <div className="grid grid-cols-3 gap-4 sm:gap-5.5 lg:grid-cols-8">
        {items.map((child, i) => (
          <div key={i} className={i >= MOBILE_VISIBLE_COUNT && !expanded ? "hidden lg:block" : undefined}>
            {child}
          </div>
        ))}
      </div>
      {hasMore && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-4 flex w-full cursor-pointer items-center justify-center rounded-[13px] border border-border bg-card py-3 text-[14px] font-bold text-ink-soft transition hover:bg-surface lg:hidden"
        >
          {showMoreLabel}
        </button>
      )}
    </>
  );
}
