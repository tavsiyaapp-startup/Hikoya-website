"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ChevronLeftIcon, CloseIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import {
  READER_FONT_COOKIE,
  READER_MODE_COOKIE,
  READER_SIZE_COOKIE,
  READER_THEME_COOKIE,
  READER_FONT_STACKS,
  READER_FONT_SIZES,
  READER_THEMES,
} from "@/lib/readerPrefs";
import type { ReaderPrefs } from "@/lib/readerPrefs-server";
import { readSaved, save, type TocChapter } from "@/components/story/ReaderChrome";
import { ReaderSettingsPanel, setReaderCookie } from "@/components/story/ReaderSettingsPanel";

// «Sahifalab»: the chapter as a book, turned page by page — two pages side
// by side on wide screens, one on phones. One chapter at a time, like the
// scrolling reader: the last page is a «what's next» card, turning past it
// opens the next chapter, turning back from the first page opens the
// previous chapter at its end.
//
// It covers the whole screen (site header and menu out of the way); «‹» and
// Esc go to the story page, and turning pages adds nothing to the browser
// history, so Back leaves the book too. Comments are on the chapter page
// underneath — «Izohlar» lifts the book away and «Kitobga qaytish» brings it
// back. The text keeps id="chapter-text", so quote cards (QuoteMaker) and
// the copy block work here unchanged; the reading position is the same
// per-chapter fraction the scrolling reader saves.
//
// Pages are CSS columns as tall as the page: the text flows into as many
// columns as it needs and the strip slides by one spread at a time.

const TEXT_ID = "chapter-text";
// Set before going back from page 1, so the previous chapter opens at its end.
const OPEN_AT_END_KEY = "hikoya:book-open-end";

export function BookReader({
  chapterId,
  storyTitle,
  storyHref,
  orderIndex,
  chapterTitle,
  readMinutes,
  initialPrefs,
  htmlContent,
  paragraphs,
  chapters,
  chapterHref,
  prevHref,
  nextHref,
  nextTitle,
  chaptersLeft,
  commentsCount,
}: {
  chapterId: string;
  storyTitle: string;
  storyHref: string;
  orderIndex: number;
  chapterTitle: string;
  readMinutes: number;
  initialPrefs: ReaderPrefs;
  htmlContent: string | null;
  paragraphs: string[] | null;
  chapters: TocChapter[];
  chapterHref: Record<number, string>;
  prevHref: string | null;
  nextHref: string | null;
  nextTitle: string | null;
  chaptersLeft: number;
  commentsCount: number;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [font, setFont] = useState(initialPrefs.font);
  const [fontSize, setFontSize] = useState(initialPrefs.fontSize);
  const [theme, setTheme] = useState(initialPrefs.theme);
  const [spread, setSpread] = useState(0);
  const [total, setTotal] = useState(1);
  const [two, setTwo] = useState(false);
  const [ready, setReady] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  // false while the reader looks at the comments underneath
  const [bookOpen, setBookOpen] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef(1);
  const spreadRef = useRef(0);
  const totalRef = useRef(1);
  const currentTocRef = useRef<HTMLAnchorElement>(null);

  const sizeStyle = READER_FONT_SIZES[fontSize];
  const themeStyle = READER_THEMES[theme];

  const show = useCallback((s: number, animate: boolean) => {
    const flow = flowRef.current;
    const clamped = Math.max(0, Math.min(totalRef.current - 1, s));
    spreadRef.current = clamped;
    setSpread(clamped);
    if (flow) {
      flow.style.transition = animate ? "" : "none";
      flow.style.transform = `translateX(${-clamped * stepRef.current}px)`;
    }
    window.getSelection()?.removeAllRanges();
  }, []);

  // Measure the pages; `keep` holds the place (as a share of the chapter)
  // across a resize or a font change.
  const layout = useCallback(
    (keep: number | null) => {
      const viewport = viewportRef.current;
      const flow = flowRef.current;
      if (!viewport || !flow) return;
      const w = viewport.clientWidth;
      // Hidden (the reader is at the comments) — nothing to measure.
      if (w < 50) return;
      const isTwo = window.innerWidth >= 900;
      const gap = isTwo ? 64 : 32;
      flow.style.columnGap = `${gap}px`;
      flow.style.columnWidth = `${isTwo ? (w - gap) / 2 : w}px`;
      flow.style.width = `${w}px`;
      stepRef.current = w + gap;
      const count = Math.max(1, Math.ceil((flow.scrollWidth + gap - 2) / stepRef.current));
      totalRef.current = count;
      setTotal(count);
      setTwo(isTwo);
      const at = keep === null ? spreadRef.current : Math.round(keep * (count - 1));
      show(at, false);
    },
    [show]
  );

  const fraction = useCallback(() => (totalRef.current > 1 ? spreadRef.current / (totalRef.current - 1) : 0), []);

  // First layout: after the fonts arrive, open where the reader stopped (or
  // at the end, when they came back from the next chapter's first page).
  useLayoutEffect(() => {
    let cancelled = false;
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (cancelled) return;
      layout(0);
      let start = 0;
      try {
        if (sessionStorage.getItem(OPEN_AT_END_KEY) === window.location.pathname) {
          sessionStorage.removeItem(OPEN_AT_END_KEY);
          start = totalRef.current - 1;
        } else {
          const saved = readSaved(chapterId);
          // Never straight onto the «what's next» page.
          if (saved !== null && saved < 0.97) start = Math.min(totalRef.current - 2, Math.round(saved * (totalRef.current - 1)));
        }
      } catch {
        // storage off — start at the beginning
      }
      show(Math.max(0, start), false);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [chapterId, layout, show]);

  // Font changes reflow the text; a resize changes the page size; a picture
  // finishing loading changes how much fits.
  useEffect(() => {
    if (!ready) return;
    layout(fraction());
  }, [font, fontSize, ready, layout, fraction]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const flow = flowRef.current;
    if (!viewport || !flow) return;
    let frame = 0;
    const relayout = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => layout(fraction()));
    };
    const observer = new ResizeObserver(relayout);
    observer.observe(viewport);
    flow.querySelectorAll("img").forEach((img) => img.addEventListener("load", relayout));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [layout, fraction]);

  // Remember the place; the last page counts as finished.
  useEffect(() => {
    if (!ready) return;
    save(chapterId, total > 1 ? spread / (total - 1) : 1);
  }, [chapterId, ready, spread, total]);

  // The book covers the page: no page scroll behind it, no floating site
  // menu (html[data-reader] hides it, same as the scrolling reader).
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.reader = "1";
    if (bookOpen) root.style.overflow = "hidden";
    return () => {
      delete root.dataset.reader;
      root.style.overflow = "";
    };
  }, [bookOpen]);

  const turn = useCallback(
    (dir: 1 | -1) => {
      const target = spreadRef.current + dir;
      if (target > totalRef.current - 1) {
        if (nextHref) router.push(nextHref);
        return;
      }
      if (target < 0) {
        if (prevHref) {
          try {
            sessionStorage.setItem(OPEN_AT_END_KEY, prevHref);
          } catch {
            // opens at its saved place instead
          }
          router.push(prevHref);
        }
        return;
      }
      show(target, true);
    },
    [nextHref, prevHref, router, show]
  );

  const leave = useCallback(() => router.push(storyHref), [router, storyHref]);

  // Keys: arrows / PageUp / PageDown / Space turn pages, Esc closes what's
  // open or leaves the book.
  useEffect(() => {
    if (!bookOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
      const dialog = document.querySelector('[role="dialog"]');
      if (e.key === "Escape") {
        if (settingsOpen || tocOpen) {
          setSettingsOpen(false);
          setTocOpen(false);
        } else if (!dialog) leave();
        return;
      }
      if (dialog) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        turn(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        turn(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bookOpen, leave, settingsOpen, tocOpen, turn]);

  // Swipe to turn; a long-press selection (for a quote) is left alone.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    const start = (e: TouchEvent) => {
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      t0 = Date.now();
    };
    const end = (e: TouchEvent) => {
      if (window.getSelection()?.toString()) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      if (Date.now() - t0 > 800 || Math.abs(dx) < 50 || Math.abs(dy) > 70) return;
      turn(dx < 0 ? 1 : -1);
    };
    viewport.addEventListener("touchstart", start, { passive: true });
    viewport.addEventListener("touchend", end, { passive: true });
    return () => {
      viewport.removeEventListener("touchstart", start);
      viewport.removeEventListener("touchend", end);
    };
  }, [turn]);

  useEffect(() => {
    if (tocOpen) currentTocRef.current?.scrollIntoView({ block: "center" });
  }, [tocOpen]);

  // A tap: left third back, right third forward, middle shows/hides the bars.
  function onPageClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("a,button")) return;
    if (window.getSelection()?.toString()) return;
    setSettingsOpen(false);
    const x = e.clientX / window.innerWidth;
    if (x < 0.3) turn(-1);
    else if (x > 0.7) turn(1);
    else setChromeHidden((h) => !h);
  }

  function openComments() {
    setBookOpen(false);
    requestAnimationFrame(() => document.getElementById("comments")?.scrollIntoView({ block: "start" }));
  }

  const pages = two ? 2 : 1;
  const atEnd = spread >= total - 1;
  const pct = total > 1 ? Math.round((spread / (total - 1)) * 100) : 100;
  const minutesLeft = Math.max(1, Math.ceil(readMinutes * (1 - (total > 1 ? spread / (total - 1) : 1))));
  // Chrome colours follow the page theme: muted = text at half strength.
  const muted = `color-mix(in srgb, ${themeStyle.text} 58%, transparent)`;
  const line = `color-mix(in srgb, ${themeStyle.text} 14%, transparent)`;
  const iconBtn = "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition hover:bg-[var(--book-line)]";

  return (
    <>
    {/* Kept mounted (only hidden) while the reader is at the comments, so the
        book comes back on the same page. */}
    {!bookOpen && (
      <button
        type="button"
        onClick={() => {
          setBookOpen(true);
          window.scrollTo({ top: 0 });
        }}
        className="fixed inset-x-0 bottom-4 z-30 mx-auto flex h-12 w-fit cursor-pointer items-center gap-2 rounded-full bg-accent px-5 text-[14.5px] font-bold text-on-accent shadow-[0_14px_30px_-12px_rgba(85,53,166,0.6)]"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        📖 {t.reader.backToBook}
      </button>
    )}
    <div
      className={clsx("fixed inset-0 z-[45] flex-col", bookOpen ? "flex" : "hidden")}
      style={
        {
          backgroundColor: themeStyle.bg,
          color: themeStyle.text,
          "--book-muted": muted,
          "--book-line": line,
        } as React.CSSProperties
      }
    >
      {/* top bar */}
      <header
        className={clsx(
          "flex h-14 shrink-0 items-center gap-2 px-2 transition duration-300 sm:h-16 sm:px-5",
          chromeHidden && "pointer-events-none -translate-y-3 opacity-0"
        )}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <Link prefetch={false} href={storyHref} aria-label={t.reader.storyPage} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full pl-1 pr-3 transition hover:bg-[var(--book-line)]">
          <ChevronLeftIcon />
          <span className="font-script hidden text-[21px] sm:inline">{t.common.brand}</span>
        </Link>
        <div className="min-w-0 flex-1 truncate text-[12.5px] font-semibold sm:text-center sm:text-[13.5px]" style={{ color: muted }}>
          <b className="font-bold" style={{ color: themeStyle.text }}>
            {storyTitle}
          </b>{" "}
          · {t.reader.chapterLabel} {orderIndex}
        </div>
        <button type="button" onClick={() => { setSettingsOpen(false); setTocOpen(true); }} aria-label={t.reader.tableOfContents} className={iconBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
            <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label={t.reader.readerSettings}
          className={clsx(iconBtn, "font-display text-[17px] font-bold")}
        >
          Aa
        </button>
      </header>

      {/* the pages */}
      <div className="flex min-h-0 flex-1 justify-center pt-2 pb-3 sm:pt-4">
        <div
          ref={viewportRef}
          onClick={onPageClick}
          className="relative h-full w-[calc(100vw-40px)] max-w-[1100px] overflow-hidden min-[900px]:w-[calc(100vw-120px)]"
        >
          <div
            ref={flowRef}
            id={TEXT_ID}
            className={clsx(
              "h-full transition-transform duration-500 ease-[cubic-bezier(.32,.72,0,1)] [column-fill:auto]",
              "[&_img]:mx-auto [&_img]:max-h-[60dvh] [&_img]:w-auto [&_img]:max-w-full [&_img]:break-inside-avoid [&_h1]:break-after-avoid [&_h2]:break-after-avoid [&_h3]:break-after-avoid",
              !ready && "opacity-0"
            )}
            style={{ fontFamily: READER_FONT_STACKS[font], fontSize: sizeStyle.fontSize, lineHeight: sizeStyle.lineHeight }}
          >
            <div className="pb-[1.4em] pt-[8%] text-center">
              <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-primary-600" style={{ fontFamily: "var(--font-sans)" }}>
                {t.reader.chapterLabel} {orderIndex}
              </div>
              <h1 className="mt-2 font-display text-[1.6em] font-bold leading-tight">{chapterTitle}</h1>
              <div className="mt-2 tracking-[0.5em]" style={{ color: muted }}>
                · · ·
              </div>
            </div>
            {htmlContent ? (
              <div className="rich-content" dangerouslySetInnerHTML={{ __html: htmlContent }} />
            ) : (
              (paragraphs ?? []).map((p, i) => (
                <p key={i} className="mb-[0.9em]">
                  {p}
                </p>
              ))
            )}

            {/* The last page: what's next. */}
            <div className="flex h-full break-before-column items-center justify-center" style={{ fontFamily: "var(--font-sans)" }}>
              <div className="w-full max-w-[420px] rounded-[22px] border px-6 py-8 text-center" style={{ borderColor: line }}>
                <div className="text-[11.5px] font-bold uppercase tracking-[0.16em]" style={{ color: muted }}>
                  {t.reader.chapterFinished.replace("{n}", String(orderIndex))}
                </div>
                {nextHref && nextTitle ? (
                  <>
                    <div className="mt-4 text-[13px] font-semibold" style={{ color: muted }}>
                      {t.reader.nextChapterLabel}
                    </div>
                    <h2 className="mx-auto mb-5 mt-1 max-w-[26ch] font-display text-[24px] font-bold leading-snug">{nextTitle}</h2>
                    <Link prefetch={false} href={nextHref} className="inline-block">
                      <Button size="lg">{t.reader.keepReading} →</Button>
                    </Link>
                    {chaptersLeft > 1 && (
                      <div className="mt-3 text-[13px]" style={{ color: muted }}>
                        {t.reader.chaptersLeft.replace("{n}", String(chaptersLeft))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="mx-auto mb-2 mt-4 max-w-[28ch] font-display text-[23px] font-bold leading-snug">{t.reader.lastChapterTitle}</h2>
                    <p className="mx-auto max-w-[40ch] text-[14px] leading-relaxed" style={{ color: muted }}>
                      {t.reader.lastChapterBody}
                    </p>
                  </>
                )}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t pt-5 text-[13.5px] font-bold text-primary-700" style={{ borderColor: line }}>
                  <button type="button" onClick={openComments} className="cursor-pointer hover:underline">
                    💬 {t.reader.commentsCount.replace("{n}", String(commentsCount))}
                  </button>
                  <Link prefetch={false} href={storyHref} className="hover:underline">
                    {t.reader.storyPage}
                  </Link>
                </div>
              </div>
            </div>
          </div>
          {two && <div aria-hidden className="pointer-events-none absolute inset-y-[4%] left-1/2 w-px" style={{ background: `linear-gradient(transparent, ${line} 20%, ${line} 80%, transparent)` }} />}
        </div>
      </div>

      {/* bottom bar */}
      <footer
        className={clsx(
          "shrink-0 px-4 pb-3 transition duration-300 sm:px-6",
          chromeHidden && "pointer-events-none translate-y-3 opacity-0"
        )}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex justify-between gap-3 text-[12.5px] font-semibold" style={{ color: muted }}>
          <span className="truncate">{chapterTitle}</span>
          <span className="shrink-0 tabular-nums">
            {t.reader.pageOf.replace("{n}", String(Math.min(spread * pages + 1, total * pages))).replace("{total}", String(total * pages))} · {pct}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={spread}
          onChange={(e) => show(Number(e.target.value), false)}
          aria-label={t.reader.readerSettings}
          className="my-1 h-5 w-full cursor-pointer accent-[var(--color-accent)]"
        />
        <div className="text-center text-[12.5px] font-bold" style={{ color: muted }}>
          {atEnd ? t.reader.chapterDone : t.reader.chapterLeftMinutes.replace("{n}", String(minutesLeft))}
        </div>
      </footer>

      {settingsOpen && (
        <>
          <button type="button" aria-label={t.common.close} onClick={() => setSettingsOpen(false)} className="fixed inset-0 z-[49] cursor-default" />
          <div className="fixed inset-x-3 top-16 z-50 mx-auto max-w-sm rounded-[18px] border border-border bg-card p-4 text-ink shadow-[0_18px_40px_-16px_rgba(45,31,85,0.45)] sm:left-auto sm:right-5 sm:mx-0 sm:w-80">
            <ReaderSettingsPanel
              mode="pages"
              font={font}
              fontSize={fontSize}
              theme={theme}
              onMode={(m) => {
                if (m === "pages") return;
                setReaderCookie(READER_MODE_COOKIE, m);
                router.refresh();
              }}
              onFont={(f) => {
                setFont(f);
                setReaderCookie(READER_FONT_COOKIE, f);
              }}
              onFontSize={(s) => {
                setFontSize(s);
                setReaderCookie(READER_SIZE_COOKIE, s);
              }}
              onTheme={(th) => {
                setTheme(th);
                setReaderCookie(READER_THEME_COOKIE, th);
              }}
            />
          </div>
        </>
      )}

      {tocOpen && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center text-ink sm:items-center" role="dialog" aria-modal aria-label={t.reader.tableOfContents}>
          <button type="button" aria-label={t.common.close} onClick={() => setTocOpen(false)} className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[2px]" />
          <div className="relative flex max-h-[75dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[26px] bg-card shadow-[0_-20px_60px_-20px_rgba(45,31,85,0.5)] sm:rounded-[26px]">
            <div className="flex items-center justify-between border-b border-border-soft px-5 py-4">
              <h2 className="text-[20px] font-bold">{t.reader.tableOfContents}</h2>
              <button type="button" onClick={() => setTocOpen(false)} aria-label={t.common.close} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full hover:bg-surface">
                <CloseIcon />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain py-1.5" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
              {chapters.map((c) => {
                const current = c.order_index === orderIndex;
                return (
                  <Link
                    prefetch={false}
                    key={c.order_index}
                    ref={current ? currentTocRef : undefined}
                    href={chapterHref[c.order_index]}
                    onClick={() => setTocOpen(false)}
                    aria-current={current ? "page" : undefined}
                    className={clsx("flex items-center gap-4 px-5 py-3.5 transition hover:bg-primary-50/70", current && "bg-primary-50")}
                  >
                    <span className="w-8 shrink-0 font-display text-[17px] font-semibold tabular-nums text-primary-400">
                      {String(c.order_index).padStart(2, "0")}
                    </span>
                    <span className={clsx("min-w-0 flex-1 font-display text-[15.5px] font-semibold leading-snug", c.read && !current ? "text-muted-2" : "text-ink")}>
                      {c.title}
                      {current && <span className="mt-0.5 block font-sans text-[11.5px] font-bold text-primary-700">{t.reader.currentChapter}</span>}
                    </span>
                    {c.read && !current && (
                      <span title={t.reader.chapterRead} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-[11px] font-bold text-success">
                        ✓
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
