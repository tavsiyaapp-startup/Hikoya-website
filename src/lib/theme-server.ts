import "server-only";
import { cookies } from "next/headers";
import { THEME_COOKIE, defaultTheme, isTheme, type Theme } from "./theme";

export async function getServerTheme(): Promise<Theme> {
  const store = await cookies();
  const value = store.get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : defaultTheme;
}
