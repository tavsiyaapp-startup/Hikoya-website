"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SettingsIcon } from "@/components/ui/icons";
import {
  READER_FONT_COOKIE,
  READER_SIZE_COOKIE,
  READER_THEME_COOKIE,
  READER_FONT_STACKS,
  READER_FONT_SIZES,
  READER_THEMES,
  type ReaderFont,
  type ReaderFontSize,
  type ReaderTheme,
} from "@/lib/readerPrefs";
import type { ReaderPrefs } from "@/lib/readerPrefs-server";

const FONTS: ReaderFont[] = ["sans", "serif", "rounded"];
const SIZES: ReaderFontSize[] = ["sm", "md", "lg", "xl"];
const THEMES: ReaderTheme[] = ["light", "sepia", "dark", "green"];

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

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
  const [font, setFont] = useState(initialPrefs.font);
  const [fontSize, setFontSize] = useState(initialPrefs.fontSize);
  const [theme, setTheme] = useState(initialPrefs.theme);
  const [open, setOpen] = useState(false);

  const sizeStyle = READER_FONT_SIZES[fontSize];
  const themeStyle = READER_THEMES[theme];
  const fontFamily = READER_FONT_STACKS[font];

  return (
    <div>
      <div className="relative mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
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
              className="fixed inset-0 z-10 cursor-default"
            />
            <div className="absolute right-0 top-12 z-20 w-72 rounded-[14px] border border-border bg-card p-4 shadow-[0_14px_34px_rgba(60,40,120,0.18)]">
              <div className="mb-3.5">
                <div className="mb-2 text-[12.5px] font-bold text-muted-2">{t.reader.fontFamily}</div>
                <div className="flex gap-2">
                  {FONTS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        setFont(f);
                        setCookie(READER_FONT_COOKIE, f);
                      }}
                      style={{ fontFamily: READER_FONT_STACKS[f] }}
                      className={clsx(
                        "h-10 flex-1 cursor-pointer rounded-[10px] border text-[14px] font-bold",
                        font === f ? "border-primary-400 bg-primary-50 text-primary-900" : "border-border text-ink-soft"
                      )}
                    >
                      Аа
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3.5">
                <div className="mb-2 text-[12.5px] font-bold text-muted-2">{t.reader.fontSize}</div>
                <div className="flex gap-2">
                  {SIZES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setFontSize(s);
                        setCookie(READER_SIZE_COOKIE, s);
                      }}
                      className={clsx(
                        "flex h-10 flex-1 cursor-pointer items-center justify-center rounded-[10px] border font-bold",
                        fontSize === s ? "border-primary-400 bg-primary-50 text-primary-900" : "border-border text-ink-soft"
                      )}
                      style={{ fontSize: READER_FONT_SIZES[s].fontSize }}
                    >
                      А
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[12.5px] font-bold text-muted-2">{t.reader.colorTheme}</div>
                <div className="flex gap-2">
                  {THEMES.map((th) => (
                    <button
                      key={th}
                      type="button"
                      onClick={() => {
                        setTheme(th);
                        setCookie(READER_THEME_COOKIE, th);
                      }}
                      aria-label={t.reader.themeLabels[th]}
                      title={t.reader.themeLabels[th]}
                      style={{ backgroundColor: READER_THEMES[th].bg, color: READER_THEMES[th].text }}
                      className={clsx(
                        "flex h-10 flex-1 cursor-pointer items-center justify-center rounded-[10px] border-2 text-[13px] font-bold",
                        theme === th ? "border-primary-500" : "border-border"
                      )}
                    >
                      Аа
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div
        className="rounded-[16px] border border-border p-5 sm:p-8"
        style={{ backgroundColor: themeStyle.bg, color: themeStyle.text, fontFamily }}
      >
        {htmlContent ? (
          <div
            className="rich-content"
            style={{ fontSize: sizeStyle.fontSize, lineHeight: sizeStyle.lineHeight }}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        ) : (
          <div style={{ fontSize: sizeStyle.fontSize, lineHeight: sizeStyle.lineHeight }}>
            {(paragraphs ?? []).map((p, i) => (
              <p key={i} className="mb-4.5">
                {p}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
