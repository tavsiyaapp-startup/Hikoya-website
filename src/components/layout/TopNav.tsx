"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";
import {
  BoardIcon,
  CloseIcon,
  CollectionsIcon,
  HomeIcon,
  InstagramIcon,
  LibraryIcon,
  LockIcon,
  MenuIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  UserIcon,
} from "@/components/ui/icons";
import type { CurrentUser } from "@/lib/current-user";

// Same site accounts already linked from the Footer — icon-only here, no
// label, since this bar is otherwise all primary site navigation.
const INSTAGRAM_URL = "https://www.instagram.com/hikoya.yoz?stkn=Z2ZweDlvNjVvb2Nm";
const TELEGRAM_URL = "https://t.me/hikoya_yoz";

export function TopNav({ user }: { user: CurrentUser | null }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = [
    { href: ROUTES.home, icon: HomeIcon, label: t.nav.home, locked: false },
    { href: ROUTES.search, icon: SearchIcon, label: t.nav.search, locked: false },
    { href: user ? ROUTES.library : ROUTES.onboarding, icon: LibraryIcon, label: t.nav.library, locked: !user },
    { href: ROUTES.collections, icon: CollectionsIcon, label: t.nav.collections, locked: false },
    { href: ROUTES.board, icon: BoardIcon, label: t.nav.board, locked: false },
    { href: user ? ROUTES.create : ROUTES.onboarding, icon: PlusIcon, label: t.nav.create, locked: !user },
    {
      href: user ? ROUTES.author(user.profile?.username ?? "") : ROUTES.onboarding,
      icon: UserIcon,
      label: t.nav.profile,
      locked: !user,
    },
  ];

  return (
    <>
      {/* z-20, same tier as Header: in-page content (e.g. StoryCard's status
          ribbon) uses z-10, and with equal z-index the later-in-DOM content
          would paint over this sticky bar once it scrolls underneath it.
          Below sm this bar doesn't render at all (hidden sm:block) — the
          drawer opens from the floating button instead, so there's nothing
          left to put in a mobile-width row here. */}
      <nav className="sticky top-[76px] z-20 hidden border-b border-border bg-card/92 backdrop-blur-md sm:block">
        <div className="flex items-center px-5 lg:px-8">
          {/* w-fit + mx-auto (not justify-center) so the item group stays
              centered when it fits, but on narrow screens where it overflows,
              auto margins collapse to 0 and both ends stay reachable by
              scroll — justify-center would clip the start on overflow. */}
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="mx-auto flex w-fit gap-1 py-2">
              {items.map((item) => {
                const active = pathname === item.href.split("?")[0];
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    title={item.locked ? t.common.guestLockedTitle : undefined}
                    className={clsx(
                      "flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-[12px] px-3.5 text-[14px] font-semibold transition",
                      active ? "bg-primary-50 text-primary-900" : "text-ink-soft hover:bg-surface"
                    )}
                  >
                    <span className="flex h-[20px] w-[20px] shrink-0 items-center justify-center">
                      <item.icon />
                    </span>
                    <span>{item.label}</span>
                    {item.locked && (
                      <span className="flex items-center text-muted-3">
                        <LockIcon />
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="ml-2 flex shrink-0 items-center gap-1.5 border-l border-border-soft pl-3">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="flex h-9 w-9 items-center justify-center rounded-[11px] text-ink-soft transition hover:bg-surface"
            >
              <InstagramIcon width={17} height={17} />
            </a>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="flex h-9 w-9 items-center justify-center rounded-[11px] text-ink-soft transition hover:bg-surface"
            >
              <SendIcon width={17} height={17} />
            </a>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 sm:hidden"
          aria-hidden
        />
      )}

      {/* Speed-dial style: items pop up directly above the FAB itself
          instead of a side drawer. Always rendered (not conditionally
          mounted) so the closed state can transition out instead of
          just vanishing; bottom offset is per-item math (FAB height +
          gap, then each pill's own height + gap), closest item first. */}
      {items.map((item, i) => {
        const active = pathname === item.href.split("?")[0];
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            title={item.locked ? t.common.guestLockedTitle : undefined}
            style={{ bottom: `${86 + i * 54}px` }}
            className={clsx(
              "fixed right-4 z-30 flex h-11 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full border border-border bg-card py-0 pl-3 pr-4.5 text-[13.5px] font-bold shadow-[0_8px_20px_rgba(30,20,60,0.18)] transition-all duration-200 sm:hidden",
              active ? "text-primary-900" : "text-ink-soft",
              mobileOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2.5 opacity-0"
            )}
          >
            <span
              className={clsx(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                active ? "bg-primary-100 text-primary-800" : "bg-surface text-ink-soft"
              )}
            >
              <item.icon width={15} height={15} />
            </span>
            {item.label}
            {item.locked && (
              <span className="flex items-center text-muted-3">
                <LockIcon />
              </span>
            )}
          </Link>
        );
      })}

      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={t.nav.home}
        className="fixed bottom-5 right-4 z-30 flex h-13 w-13 cursor-pointer items-center justify-center rounded-full bg-linear-to-br from-[#6D28D9] to-[#9333EA] text-white shadow-[0_10px_24px_rgba(109,40,217,0.35)] transition hover:brightness-110 sm:hidden"
      >
        {mobileOpen ? <CloseIcon /> : <MenuIcon />}
      </button>
    </>
  );
}
