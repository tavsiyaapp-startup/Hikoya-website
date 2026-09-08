import type { Dictionary } from "@/lib/i18n";

// stories.language is free text now — "ru"/"uz" are translated per-locale
// via t.languages, anything else is whatever the author typed (same word
// regardless of viewer locale, like a custom genre).
export function languageLabel(t: Dictionary, code: string): string {
  return code === "ru" || code === "uz" ? t.languages[code] : code;
}
