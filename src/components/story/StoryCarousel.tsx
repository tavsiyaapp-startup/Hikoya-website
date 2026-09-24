"use client";

import { Children, useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

const SCROLL_AMOUNT = 640;

// Horizontal, arrow-scrolled row — same StoryCard children as the grid it
// replaces, just given a fixed per-breakpoint width (a flex row has no
// column tracks to size them, unlike the grid) and wrapped in a scroll
// container instead of laid out in rows.
export function StoryCarousel({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children);

  function scroll(direction: 1 | -1) {
    trackRef.current?.scrollBy({ left: direction * SCROLL_AMOUNT, behavior: "smooth" });
  }

  return (
    <div className="relative">
      {/* pt-4: StoryCard's status ribbon pokes up 14px above the card itself
          (-top-3.5). Setting overflow-x without an explicit overflow-y makes
          the browser treat overflow-y as auto too (CSS overflow spec), which
          was clipping that ribbon against the track's own top edge — this
          padding gives it room to render instead of being cut off. pl-2: the
          same ribbon also pokes 4px left of the first card (-left-1) — with
          no left padding that got clipped by the track's own left edge too. */}
      <div ref={trackRef} className="no-scrollbar flex gap-4 overflow-x-auto scroll-smooth pl-2 pt-4 sm:gap-5.5">
        {items.map((child, i) => (
          <div key={i} className="w-[118px] shrink-0 xs:w-[138px] sm:w-[158px] lg:w-[172px]">
            {child}
          </div>
        ))}
      </div>

      {items.length > 4 && (
        <>
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label="Previous"
            className="absolute -left-3.5 top-[calc(42%+8px)] z-10 hidden h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-ink-soft shadow-[0_4px_14px_rgba(60,40,120,0.16)] transition hover:bg-surface sm:flex"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label="Next"
            className="absolute -right-3.5 top-[calc(42%+8px)] z-10 hidden h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-ink-soft shadow-[0_4px_14px_rgba(60,40,120,0.16)] transition hover:bg-surface sm:flex"
          >
            <ChevronRightIcon />
          </button>
        </>
      )}
    </div>
  );
}
