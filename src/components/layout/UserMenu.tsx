"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useTheme } from "@/lib/ThemeProvider";
import { ROUTES } from "@/lib/constants";
import { Avatar } from "@/components/ui/Avatar";
import { Toggle } from "@/components/ui/Toggle";
import { SignOutButton } from "@/components/profile/SignOutButton";
import type { CurrentUser } from "@/lib/current-user";

export function UserMenu({ user }: { user: CurrentUser }) {
  const { t } = useLocale();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const username = user.profile?.username ?? "";
  const displayName = user.profile?.display_name ?? "?";

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.nav.profile}
        className="flex shrink-0 cursor-pointer items-center gap-2"
      >
        <Avatar name={displayName} src={user.profile?.avatar_url} size={38} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl border border-border bg-card p-2 shadow-[0_14px_30px_rgba(60,40,120,0.14)]">
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <Avatar name={displayName} src={user.profile?.avatar_url} size={36} />
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-bold">{displayName}</div>
              <div className="truncate text-[12px] text-muted-2">@{username}</div>
            </div>
          </div>

          <Link
            href={ROUTES.author(username)}
            onClick={() => setOpen(false)}
            className="block rounded-xl px-2.5 py-2 text-[13.5px] font-semibold text-ink-soft transition hover:bg-surface"
          >
            {t.nav.profile}
          </Link>

          <div className="my-1 border-t border-border-soft" />

          <div className="flex items-center justify-between gap-3 px-2.5 py-2">
            <span className="text-[13.5px] font-semibold text-ink-soft">{t.profile.darkTheme}</span>
            <Toggle
              checked={theme === "dark"}
              onChange={(next) => setTheme(next ? "dark" : "light")}
              label={t.profile.darkTheme}
            />
          </div>

          <div className="my-1 border-t border-border-soft" />

          <div className="px-2.5 py-1.5">
            <SignOutButton />
          </div>
        </div>
      )}
    </div>
  );
}
