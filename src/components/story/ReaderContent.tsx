"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SettingsIcon } from "@/components/ui/icons";
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
import { TOGGLE_SETTINGS_EVENT } from "@/components/story/ReaderChrome";
import { ReaderSettingsPanel, setReaderCookie } from "@/components/story/ReaderSettingsPanel";
import { ChapterImageZoom } from "@/components/story/ChapterImageZoom";

export function ReaderContent({
  initialPrefs,
  htmlContent,
  paragraphs,
}: {
  initialPrefs: ReaderPrefs;
  htmlContent: string | null;
  paragraphs: string[] | null;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [font, setFont] = useState(initialPrefs.font);
  const [fontSize, setFontSize] = useState(initialPrefs.fontSize);
  const [theme, setTheme] = useState(initialPrefs.theme);
  const [open, setOpen] = useState(false);
  // Opened from the floating bar (ReaderChrome) the panel sits just above
  // the bar instead of at the top of the text, which may be far away.
  const [fromBar, setFromBar] = useState(false);

  useEffect(() => {
    const toggle = () => {
      setFromBar(true);
      setOpen((v) => !v);
    };
    window.addEventListener(TOGGLE_SETTINGS_EVENT, toggle);
    return () => window.removeEventListener(TOGGLE_SETTINGS_EVENT, toggle);
  }, []);

  const sizeStyle = READER_FONT_SIZES[fontSize];
  const themeStyle = READER_THEMES[theme];
  const fontFamily = READER_FONT_STACKS[font];

  return (
    <div>
      <div className="relative mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setFromBar(false);
            setOpen((v) => !v);
          }}
          aria-label={t.reader.readerSettings}
          className={clsx(
            "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border bg-card text-ink-soft transition hover:border-primary-300",
            open ? "border-primary-300 text-primary-800" : "border-border"
          )}
        >
          <SettingsIcon width={18} height={18} />
        </button>

        {open && (
          <>
            <button
              type="button"
              aria-label={t.common.close}
              onClick={() => setOpen(false)}
              className={clsx("fixed inset-0 cursor-default", fromBar ? "z-[39]" : "z-10")}
            />
            <div
              className={clsx(
                "rounded-[18px] border border-border bg-card p-4 shadow-[0_18px_40px_-16px_rgba(45,31,85,0.45)]",
                fromBar ? "fixed inset-x-3 bottom-20 z-40 mx-auto max-w-sm" : "absolute right-0 top-12 z-20 w-72"
              )}
            >
              <ReaderSettingsPanel
                mode="scroll"
                font={font}
                fontSize={fontSize}
                theme={theme}
                // The book reader is a different page layout — the server
                // renders it once the cookie says so.
                onMode={(m) => {
                  if (m === "scroll") return;
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
      </div>

      <div
        id="chapter-text"
        className="mx-auto max-w-[calc(75ch+5rem)] rounded-[20px] border border-border px-5 py-6 shadow-[0_24px_50px_-34px_rgba(45,31,85,0.4)] sm:px-10 sm:py-10"
        style={{ backgroundColor: themeStyle.bg, color: themeStyle.text, fontFamily, fontSize: sizeStyle.fontSize }}
      >
        {/* A book's measure: about 75 characters per line. The page itself
            is only that wide (+ its padding) — no empty paper either side on
            wide screens. The font size sits on the page so `ch` here and on
            the text are the same unit. */}
        {htmlContent ? (
          <div
            className="rich-content max-w-[75ch] [&_img]:cursor-zoom-in"
            style={{ lineHeight: sizeStyle.lineHeight }}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        ) : (
          <div className="max-w-[75ch]" style={{ lineHeight: sizeStyle.lineHeight }}>
            {(paragraphs ?? []).map((p, i) => (
              <p key={i} className="mb-4.5">
                {p}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Tap an author-embedded image (e.g. a character sheet) to enlarge it. */}
      <ChapterImageZoom />
    </div>
  );
}
