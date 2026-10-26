"use client";

import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  READER_FONT_STACKS,
  READER_FONT_SIZES,
  READER_THEMES,
  type ReaderFont,
  type ReaderFontSize,
  type ReaderMode,
  type ReaderTheme,
} from "@/lib/readerPrefs";

// The Aa panel's contents, shared by the scrolling reader (ReaderContent)
// and the book reader (BookReader); each places it where it fits.

const FONTS: ReaderFont[] = ["sans", "serif", "rounded"];
const SIZES: ReaderFontSize[] = ["sm", "md", "lg", "xl"];
const THEMES: ReaderTheme[] = ["light", "sepia", "dark", "green"];

export function setReaderCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

export function ReaderSettingsPanel({
  mode,
  font,
  fontSize,
  theme,
  onMode,
  onFont,
  onFontSize,
  onTheme,
}: {
  mode: ReaderMode;
  font: ReaderFont;
  fontSize: ReaderFontSize;
  theme: ReaderTheme;
  onMode: (m: ReaderMode) => void;
  onFont: (f: ReaderFont) => void;
  onFontSize: (s: ReaderFontSize) => void;
  onTheme: (th: ReaderTheme) => void;
}) {
  const { t } = useLocale();
  const choice = (active: boolean) =>
    clsx(
      "h-10 flex-1 cursor-pointer rounded-[10px] border font-bold",
      active ? "border-primary-400 bg-primary-50 text-primary-900" : "border-border text-ink-soft"
    );

  return (
    <>
      <div className="mb-3.5">
        <div className="mb-2 text-[12.5px] font-bold text-muted-2">{t.reader.readingMode}</div>
        <div className="flex gap-2">
          {(["pages", "scroll"] as const).map((m) => (
            <button key={m} type="button" onClick={() => onMode(m)} className={clsx(choice(mode === m), "text-[13.5px]")}>
              {m === "pages" ? `📖 ${t.reader.modePages}` : `↕ ${t.reader.modeScroll}`}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3.5">
        <div className="mb-2 text-[12.5px] font-bold text-muted-2">{t.reader.fontFamily}</div>
        <div className="flex gap-2">
          {FONTS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFont(f)}
              style={{ fontFamily: READER_FONT_STACKS[f] }}
              className={clsx(choice(font === f), "text-[14px]")}
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
              onClick={() => onFontSize(s)}
              className={clsx(choice(fontSize === s), "flex items-center justify-center")}
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
              onClick={() => onTheme(th)}
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
    </>
  );
}
