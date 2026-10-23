"use client";

import { clsx } from "clsx";
import { useTheme } from "@/lib/ThemeProvider";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { MoonIcon, SunIcon } from "@/components/ui/icons";

// Light/dark switch for everyone, guests included (signed-in people also
// have it in their menu and profile). The choice is a cookie on this device
// — see ThemeProvider.
export function ThemeSwitch({ className, withLabel }: { className?: string; withLabel?: boolean }) {
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-pressed={dark}
      aria-label={t.profile.darkTheme}
      title={t.profile.darkTheme}
      className={clsx(
        "flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-card text-ink-soft transition hover:border-primary-200 hover:text-ink",
        withLabel ? "h-9 px-3.5 text-[13px] font-semibold" : "h-10 w-10 sm:h-11 sm:w-11",
        className
      )}
    >
      {dark ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
      {withLabel && <span>{t.profile.darkTheme}</span>}
    </button>
  );
}
