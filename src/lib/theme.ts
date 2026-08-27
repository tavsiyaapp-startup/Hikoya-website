export const THEME_COOKIE = "hikoya_theme";
export type Theme = "light" | "dark";
export const defaultTheme: Theme = "light";

export function isTheme(value: string | undefined | null): value is Theme {
  return value === "light" || value === "dark";
}
