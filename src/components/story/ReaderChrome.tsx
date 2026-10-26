"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@/components/ui/icons";

// Everything around the chapter text that helps reading, mostly on phones:
//  - remembers how far into this chapter you got (this device) and brings
//    you back there, with a "from the start" way out;
//  - "~N min left" from the reading position;
//  - a floating bar: previous · contents · time left · Aa · next;
//  - the contents sheet, without leaving the chapter;
//  - immersive mode: scrolling down hides the site header, menu and the
//    bar; scrolling up or a tap on the text brings them back;
//  - at the end of the chapter, a swipe left/right goes to the next or
//    previous chapter.
// The text itself (and its Aa settings) stays in ReaderContent; the two
// talk through a window event (TOGGLE_SETTINGS_EVENT).

export const TOGGLE_SETTINGS_EVENT = "hikoya:reader-settings";
const TEXT_ID = "chapter-text";
const POS_KEY = (chapterId: string) => `hikoya:pos:${chapterId}`;
// Where on the screen "the line I'm reading" is: a third of the way down.
const READ_LINE = 0.33;

// Shared with the book reader (BookReader), so switching between scrolling
// and pages keeps your place in the chapter.
export function readSaved(chapterId: string): number | null {
  try {
    const v = Number(localStorage.getItem(POS_KEY(chapterId)));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function save(chapterId: string, p: number) {
  try {
    if (p >= 0.97) localStorage.removeItem(POS_KEY(chapterId));
    else localStorage.setItem(POS_KEY(chapterId), p.toFixed(4));
  } catch {
    // Private mode / storage full: the reader just won't remember.
  }
}

function textBox() {
  const el = document.getElementById(TEXT_ID);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top + window.scrollY, height: Math.max(1, r.height) };
}

function progressNow(): number {
  const box = textBox();
  if (!box) return 0;
  const p = (window.scrollY + window.innerHeight * READ_LINE - box.top) / box.height;
  return Math.min(1, Math.max(0, p));
}

function setImmersive(on: boolean) {
  const root = document.documentElement;
  if (on) root.dataset.immersive = "1";
  else delete root.dataset.immersive;
}

export interface TocChapter {
  order_index: number;
  title: string;
  read: boolean;
}

export function ReaderChrome({
  chapterId,
  currentIndex,
  readMinutes,
  chapters,
  chapterHref,
  prevHref,
  nextHref,
}: {
  chapterId: string;
  currentIndex: number;
  readMinutes: number;
  chapters: TocChapter[];
  // ROUTES.chapter(slug, n) for this story, built on the server.
  chapterHref: Record<number, string>;
  prevHref: string | null;
  nextHref: string | null;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [resumed, setResumed] = useState(false);
  const lastY = useRef(0);
  const lastSave = useRef(0);
  const currentRef = useRef<HTMLAnchorElement>(null);

  const hide = useCallback((on: boolean) => {
    setHidden(on);
    setImmersive(on);
  }, []);

  // Mark the page as a reader page (CSS hides the site's floating menu
  // button there — the bar replaces it) and clean up on leaving.
  useEffect(() => {
    document.documentElement.dataset.reader = "1";
    return () => {
      delete document.documentElement.dataset.reader;
      setImmersive(false);
    };
  }, []);

  // Back to where you stopped last time (after fonts settle, so the text
  // has its final height).
  useEffect(() => {
    const saved = readSaved(chapterId);
    if (saved === null || saved < 0.04 || saved > 0.96) return;
    let cancelled = false;
    const go = () => {
      if (cancelled) return;
      const box = textBox();
      if (!box) return;
      window.scrollTo({ top: box.top + saved * box.height - window.innerHeight * READ_LINE, behavior: "instant" as ScrollBehavior });
      setResumed(true);
    };
    (document.fonts?.ready ?? Promise.resolve()).then(() => requestAnimationFrame(go));
    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  useEffect(() => {
    if (!resumed) return;
    const id = setTimeout(() => setResumed(false), 7000);
    return () => clearTimeout(id);
  }, [resumed]);

  // One passive scroll listener, work batched into an animation frame.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const p = progressNow();
        setProgress(p);
        const nearEnd = window.innerHeight + y > document.documentElement.scrollHeight - 160;
        if (nearEnd || y < 120) hide(false);
        else if (y > lastY.current + 10) hide(true);
        else if (y < lastY.current - 10) hide(false);
        lastY.current = y;
        const now = Date.now();
        if (now - lastSave.current > 800) {
          lastSave.current = now;
          save(chapterId, p);
        }
      });
    };
    const onLeave = () => save(chapterId, progressNow());
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onLeave);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onLeave);
      cancelAnimationFrame(frame);
      onLeave();
    };
  }, [chapterId, hide]);

  // A tap on the text (not a link, not a selection) shows/hides the chrome.
  useEffect(() => {
    const el = document.getElementById(TEXT_ID);
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("a,button")) return;
      if (window.getSelection()?.toString()) return;
      setHidden((h) => {
        setImmersive(!h);
        return !h;
      });
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, []);

  // Swipe between chapters, only once the chapter has been read to the end
  // (so a sideways thumb while reading never throws you out of it).
  useEffect(() => {
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    const start = (e: TouchEvent) => {
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      t0 = Date.now();
    };
    const end = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      if (Date.now() - t0 > 700 || Math.abs(dx) < 80 || Math.abs(dy) > 50) return;
      if (progressNow() < 0.92) return;
      if (dx < 0 && nextHref) router.push(nextHref);
      else if (dx > 0 && prevHref) router.push(prevHref);
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchend", end, { passive: true });
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchend", end);
    };
  }, [nextHref, prevHref, router]);

  useEffect(() => {
    if (tocOpen) currentRef.current?.scrollIntoView({ block: "center" });
  }, [tocOpen]);

  function fromStart() {
    const box = textBox();
    window.scrollTo({ top: box ? box.top - 120 : 0, behavior: "smooth" });
    save(chapterId, 0);
    setResumed(false);
  }

  const minutesLeft = Math.max(1, Math.ceil(readMinutes * (1 - progress)));
  const iconBtn =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft transition hover:bg-primary-50 disabled:opacity-30";

  return (
    <>
      {resumed && (
        <div className="fixed inset-x-3 top-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-full border border-border bg-card/90 py-2 pl-4 pr-2 text-[13px] font-semibold text-ink-soft shadow-[0_18px_40px_-20px_rgba(45,31,85,0.5)] backdrop-blur-xl">
          <span className="flex-1">{t.reader.resumeNotice}</span>
          <button type="button" onClick={fromStart} className="h-8 shrink-0 cursor-pointer rounded-full bg-primary-50 px-3 text-[12.5px] font-bold text-primary-800">
            {t.reader.resumeFromStart}
          </button>
        </div>
      )}

      <nav
        aria-label={t.reader.readerSettings}
        className={clsx(
          "fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-md items-center justify-between gap-1 rounded-full border border-border/80 bg-card/85 p-1 shadow-[0_18px_40px_-18px_rgba(45,31,85,0.55)] backdrop-blur-xl transition duration-300",
          hidden ? "pointer-events-none translate-y-[140%] opacity-0" : "translate-y-0 opacity-100"
        )}
        style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
      >
        {prevHref ? (
          <Link prefetch={false} href={prevHref} aria-label={t.reader.previousChapter} className={iconBtn}>
            <ChevronLeftIcon />
          </Link>
        ) : (
          <span className={clsx(iconBtn, "opacity-30")}>
            <ChevronLeftIcon />
          </span>
        )}
        <button type="button" onClick={() => setTocOpen(true)} aria-label={t.reader.tableOfContents} className="flex h-11 min-w-0 cursor-pointer items-center gap-2 rounded-full px-3 text-[13.5px] font-bold text-ink-soft transition hover:bg-primary-50">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
            <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
          </svg>
          <span className="hidden truncate xs:inline">{t.reader.tableOfContents}</span>
        </button>
        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-muted-2">
          {progress < 0.98 ? t.reader.minutesLeft.replace("{n}", String(minutesLeft)) : "✓"}
        </span>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(TOGGLE_SETTINGS_EVENT))}
          aria-label={t.reader.readerSettings}
          className={clsx(iconBtn, "cursor-pointer font-display text-[17px] font-bold")}
        >
          Aa
        </button>
        {nextHref ? (
          <Link prefetch={false} href={nextHref} aria-label={t.reader.nextChapterLabel} className={iconBtn}>
            <ChevronRightIcon />
          </Link>
        ) : (
          <span className={clsx(iconBtn, "opacity-30")}>
            <ChevronRightIcon />
          </span>
        )}
      </nav>

      {tocOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-label={t.reader.tableOfContents}>
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
                const current = c.order_index === currentIndex;
                return (
                  <Link
                    prefetch={false}
                    key={c.order_index}
                    ref={current ? currentRef : undefined}
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
    </>
  );
}
