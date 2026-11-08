"use client";

import { useState } from "react";
import { MangaReader } from "./MangaReader";
import type { MangaPageData } from "@/types/database";

// Inline manga reader for the real chapter page: a continuous webtoon strip
// (the common mobile manga experience) plus a "full screen" button that opens
// the richer MangaReader overlay (webtoon/paged, direction, fit). Pages are
// served through /thumb at a reading width so a 20-page chapter doesn't ship
// twenty full-size originals.
/* eslint-disable @next/next/no-img-element */

function readSrc(url: string, w: number): string {
  return url.startsWith("/uploads/") ? `/thumb/${url.slice("/uploads/".length)}?w=${w}` : url;
}

export function MangaReaderMount({ pages, title }: { pages: MangaPageData[]; title: string }) {
  const [open, setOpen] = useState(false);

  if (pages.length === 0) {
    return <p className="rounded-[12px] border border-border bg-card px-5 py-8 text-center text-[14px] text-muted-2">Bu bobda sahifalar yo‘q.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] text-muted-2">{pages.length} sahifa</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-9 rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-bold text-ink-soft hover:bg-primary-50"
        >
          To‘liq ekranda o‘qish
        </button>
      </div>

      {/* Inline webtoon strip */}
      <div className="mx-auto flex max-w-[820px] flex-col overflow-hidden rounded-[12px] bg-[#0b0b0f]">
        {pages.map((p, i) => (
          <img
            key={p.url}
            src={readSrc(p.url, 1080)}
            alt={`Sahifa ${i + 1}`}
            loading={i < 2 ? "eager" : "lazy"}
            decoding="async"
            className="block w-full select-none"
            draggable={false}
          />
        ))}
      </div>

      {open && (
        <MangaReader
          pages={pages.map((p, i) => ({ id: `${i}-${p.url}`, src: readSrc(p.url, 1080) }))}
          title={title}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
