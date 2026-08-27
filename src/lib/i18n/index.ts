import ru from "./dictionaries/ru";
import uz from "./dictionaries/uz";

export const locales = ["uz", "ru"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "uz";
export const LOCALE_COOKIE = "hikoya_locale";

export type Dictionary = typeof ru;

const dictionaries: Record<Locale, Dictionary> = { ru, uz };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
