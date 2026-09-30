// Chapter-reader display prefs — font, size, background/text theme. Same
// cookie-per-setting + server-read-first pattern as theme.ts/theme-server.ts
// (no FOUC: the very first server render already matches what's saved).

export const READER_FONT_COOKIE = "hikoya_reader_font";
export const READER_SIZE_COOKIE = "hikoya_reader_size";
export const READER_THEME_COOKIE = "hikoya_reader_theme";

export type ReaderFont = "sans" | "serif" | "rounded";
export type ReaderFontSize = "sm" | "md" | "lg" | "xl";
export type ReaderTheme = "light" | "sepia" | "dark" | "green";

export const defaultReaderFont: ReaderFont = "sans";
export const defaultReaderFontSize: ReaderFontSize = "md";
export const defaultReaderTheme: ReaderTheme = "light";

export function isReaderFont(value: string | undefined | null): value is ReaderFont {
  return value === "sans" || value === "serif" || value === "rounded";
}

export function isReaderFontSize(value: string | undefined | null): value is ReaderFontSize {
  return value === "sm" || value === "md" || value === "lg" || value === "xl";
}

export function isReaderTheme(value: string | undefined | null): value is ReaderTheme {
  return value === "light" || value === "sepia" || value === "dark" || value === "green";
}

// System font stacks only (no extra next/font loads) — Georgia and Verdana
// both ship with real Cyrillic glyphs on every mainstream OS, so RU/UZ text
// never falls back to a mismatched generic serif/sans-serif.
export const READER_FONT_STACKS: Record<ReaderFont, string> = {
  sans: "var(--font-sans)",
  serif: "Georgia, 'Noto Serif', serif",
  rounded: "Verdana, 'Segoe UI', sans-serif",
};

export const READER_FONT_SIZES: Record<ReaderFontSize, { fontSize: string; lineHeight: string }> = {
  sm: { fontSize: "15px", lineHeight: "26px" },
  md: { fontSize: "17px", lineHeight: "32px" },
  lg: { fontSize: "19px", lineHeight: "34px" },
  xl: { fontSize: "21px", lineHeight: "38px" },
};

// Background+text always change together, as one of a handful of tuned
// pairs — never two independent color pickers, so nothing unreadable
// (e.g. low-contrast or eye-straining combos) can be produced. "light"
// reuses the site's own card/ink-soft tokens so it still follows the
// site-wide dark-mode toggle exactly like before this feature existed.
export const READER_THEMES: Record<ReaderTheme, { bg: string; text: string }> = {
  light: { bg: "var(--color-card)", text: "var(--color-ink-soft)" },
  sepia: { bg: "#F4ECD8", text: "#3B2F22" },
  dark: { bg: "#1E1E22", text: "#E4E4E7" },
  green: { bg: "#E7F2E7", text: "#20361F" },
};
