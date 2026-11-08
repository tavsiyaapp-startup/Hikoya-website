"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FitMode, MangaPage, ReadingDirection, ReadingMode } from "./mangaLab";

// Full-screen manga/comic reader prototype. Two layouts:
//  • webtoon — one continuous vertical strip (Korean/Chinese style, best on phones)
//  • paged   — one page at a time, swipe / arrows / tap zones, LTR or RTL
// Images are plain <img loading="lazy"> on purpose: manga pages have arbitrary
// aspect ratios and we want the browser's native lazy-load + a cheap paint,
// not next/image's width/height contract (images are already `unoptimized` on
// this host — see next.config.ts / lib/image-resize.ts).
/* eslint-disable @next/next/no-img-element */

export function MangaReader({
  pages,
  title,
  onClose,
  initialMode = "webtoon",
  initialDirection = "ltr",
}: {
  pages: MangaPage[];
  title: string;
  onClose: () => void;
  initialMode?: ReadingMode;
  initialDirection?: ReadingDirection;
}) {
  const [mode, setMode] = useState<ReadingMode>(initialMode);
  const [direction, setDirection] = useState<ReadingDirection>(initialDirection);
  const [fit, setFit] = useState<FitMode>("width");
  const [index, setIndex] = useState(0);
  const [chrome, setChrome] = useState(true); // show/hide the top & bottom bars

  const total = pages.length;
  const clamp = useCallback((i: number) => Math.max(0, Math.min(total - 1, i)), [total]);

  // Paged navigation respects reading direction for keys & tap zones; the
  // explicit prev/next buttons always move by reading order.
  const go = useCallback((delta: number) => setIndex((i) => clamp(i + delta)), [clamp]);

  // --- Webtoon: track which page is centred, for the counter ---------------
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (mode !== "webtoon") return;
    const root = scrollRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = pageRefs.current.indexOf(e.target as HTMLDivElement);
            if (i >= 0) setIndex(i);
          }
        }
      },
      { root, threshold: 0.5 }
    );
    pageRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [mode, total]);

  // --- Paged: preload neighbours so a swipe is instant ---------------------
  useEffect(() => {
    if (mode !== "paged") return;
    for (const i of [index + 1, index + 2, index - 1]) {
      const p = pages[i];
      if (p) {
        const img = new Image();
        img.src = p.src;
      }
    }
  }, [mode, index, pages]);

  // --- Keyboard ------------------------------------------------------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") return onClose();
      if (mode !== "paged") return;
      if (e.key === "ArrowRight") go(direction === "rtl" ? -1 : 1);
      else if (e.key === "ArrowLeft") go(direction === "rtl" ? 1 : -1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, direction, go, onClose]);

  // --- Paged: touch swipe --------------------------------------------------
  const touch = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touch.current || mode !== "paged") return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return; // not a horizontal swipe
    // Swipe left (dx<0) advances in LTR, goes back in RTL.
    const forward = dx < 0;
    go((forward ? 1 : -1) * (direction === "rtl" ? -1 : 1));
  }

  const atStart = index <= 0;
  const atEnd = index >= total - 1;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#0b0b0f] text-white">
      {/* top bar */}
      <div
        className={`flex items-center gap-2 border-b border-white/10 bg-[#121018]/95 px-3 py-2 backdrop-blur transition-transform ${
          chrome ? "" : "-translate-y-full"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13.5px] font-semibold text-white/80 hover:bg-white/10"
        >
          ✕ <span className="hidden sm:inline">Yopish</span>
        </button>
        <div className="min-w-0 flex-1 truncate text-[14px] font-bold">{title}</div>

        {/* mode toggle */}
        <Segmented
          options={[
            ["webtoon", "Vebtun"],
            ["paged", "Sahifa"],
          ]}
          value={mode}
          onChange={(v) => setMode(v as ReadingMode)}
        />
      </div>

      {/* controls row (paged only): direction + fit. flex-wrap + each
          label-with-control kept as one unit, so on a narrow phone the two
          groups drop onto a second line instead of overflowing / clipping. */}
      {mode === "paged" && chrome && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 bg-[#121018]/80 px-3 py-2 text-[12px]">
          <div className="flex items-center gap-1.5">
            <span className="text-white/45">Yo‘nalish</span>
            <Segmented
              options={[
                ["ltr", "→ chapdan"],
                ["rtl", "← o‘ngdan"],
              ]}
              value={direction}
              onChange={(v) => setDirection(v as ReadingDirection)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/45">Moslash</span>
            <Segmented
              options={[
                ["width", "Eniga"],
                ["height", "Bo‘yiga"],
              ]}
              value={fit}
              onChange={(v) => setFit(v as FitMode)}
            />
          </div>
        </div>
      )}

      {/* body */}
      {mode === "webtoon" ? (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          onClick={() => setChrome((c) => !c)}
        >
          <div className="mx-auto flex max-w-[820px] flex-col">
            {pages.map((p, i) => (
              <div key={p.id} ref={(el) => void (pageRefs.current[i] = el)}>
                <img
                  src={p.src}
                  alt={`Sahifa ${i + 1}`}
                  loading={i < 2 ? "eager" : "lazy"}
                  decoding="async"
                  className="block w-full select-none"
                  draggable={false}
                />
              </div>
            ))}
            <div className="py-10 text-center text-[13px] text-white/40">— tugadi —</div>
          </div>
        </div>
      ) : (
        <div
          className="relative min-h-0 flex-1 overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className={`h-full w-full ${fit === "width" ? "overflow-y-auto" : "flex items-center justify-center"}`}>
            {pages[index] && (
              <img
                src={pages[index].src}
                alt={`Sahifa ${index + 1}`}
                decoding="async"
                draggable={false}
                className={
                  fit === "width"
                    ? "mx-auto block w-full max-w-[900px] select-none"
                    : "max-h-full max-w-full select-none object-contain"
                }
              />
            )}
          </div>

          {/* tap zones — swap sides for RTL */}
          <button
            type="button"
            aria-label="Oldingi / keyingi"
            onClick={() => go(direction === "rtl" ? 1 : -1)}
            className="absolute inset-y-0 left-0 w-1/4"
          />
          <button
            type="button"
            aria-label="Chrome"
            onClick={() => setChrome((c) => !c)}
            className="absolute inset-y-0 left-1/4 w-2/4"
          />
          <button
            type="button"
            aria-label="Keyingi / oldingi"
            onClick={() => go(direction === "rtl" ? -1 : 1)}
            className="absolute inset-y-0 right-0 w-1/4"
          />
        </div>
      )}

      {/* bottom bar */}
      <div
        className={`flex items-center gap-3 border-t border-white/10 bg-[#121018]/95 px-3 py-2 backdrop-blur transition-transform ${
          chrome ? "" : "translate-y-full"
        }`}
      >
        {mode === "paged" && (
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={atStart}
            className="h-8 rounded-lg px-2.5 text-[13px] font-semibold text-white/80 hover:bg-white/10 disabled:opacity-30"
          >
            ‹
          </button>
        )}
        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={index}
          onChange={(e) => {
            const i = Number(e.target.value);
            setIndex(i);
            if (mode === "webtoon") pageRefs.current[i]?.scrollIntoView({ behavior: "auto", block: "start" });
          }}
          className="h-1.5 flex-1 accent-[#a78bfa]"
          // RTL readers expect the slider to grow leftward in paged mode.
          style={mode === "paged" && direction === "rtl" ? { direction: "rtl" } : undefined}
        />
        <div className="tabular-nums text-[12.5px] font-semibold text-white/70">
          {index + 1} / {total}
        </div>
        {mode === "paged" && (
          <button
            type="button"
            onClick={() => go(1)}
            disabled={atEnd}
            className="h-8 rounded-lg px-2.5 text-[13px] font-semibold text-white/80 hover:bg-white/10 disabled:opacity-30"
          >
            ›
          </button>
        )}
      </div>
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex shrink-0 rounded-lg bg-white/10 p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-[7px] px-2.5 py-1 text-[12.5px] font-semibold transition ${
            value === v ? "bg-white text-[#14101f]" : "text-white/70 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
