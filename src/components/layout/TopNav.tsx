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
import { InstallAppButton } from "@/components/layout/InstallAppButton";

// Same site accounts already linked from the Footer — icon-only here, no
// label, since this bar is otherwise all primary site navigation.
const INSTAGRAM_URL = "https://www.instagram.com/hikoya.yoz?stkn=Z2ZweDlvNjVvb2Nm";
const TELEGRAM_URL = "https://t.me/hikoya_yoz";

// A topic page (/muhokamalar/<id>) still lights up «Muhokamalar».
function isActive(pathname: string, href: string) {
  const base = href.split("?")[0];
  return pathname === base || (base === ROUTES.forum && pathname.startsWith(`${ROUTES.forum}/`));
}

export function TopNav({ user }: { user: CurrentUser | null }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = [
    { href: ROUTES.home, icon: HomeIcon, label: t.nav.home, locked: false },
    { href: ROUTES.search, icon: SearchIcon, label: t.nav.search, locked: false },
    { href: user ? ROUTES.library : ROUTES.onboarding, icon: LibraryIcon, label: t.nav.library, locked: !user },
    { href: ROUTES.collections, icon: CollectionsIcon, label: t.nav.collections, locked: false },
    { href: ROUTES.forum, icon: BoardIcon, label: t.nav.forum, locked: false },
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
          ribbon) uses z-10. Below sm this bar doesn't render at all — the
          menu opens from the floating button instead. */}
      {/* Floating island (redesign): a pill that hovers under the header
          instead of a full-width bar glued to it. The outer strip stays
          transparent and lets clicks through around the pill. */}
      <nav className="site-topnav pointer-events-none sticky top-[76px] z-20 hidden px-5 py-2 sm:block lg:px-8">
        {/* w-fit + mx-auto (not justify-center) so the pill stays centered
            when it fits, but on narrow screens where it overflows, auto
            margins collapse to 0 and both ends stay reachable by scroll. */}
        <div className="pointer-events-auto mx-auto flex w-fit max-w-full items-center rounded-full border border-border/80 bg-card/80 p-1 shadow-[0_12px_32px_-18px_rgba(45,31,85,0.45)] backdrop-blur-xl">
          <div className="no-scrollbar flex min-w-0 gap-0.5 overflow-x-auto">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link prefetch={false}
                  key={item.label}
                  href={item.href}
                  title={item.locked ? t.common.guestLockedTitle : undefined}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[14px] font-semibold transition",
                    active ? "bg-ink text-card hover:text-card" : "text-ink-soft hover:bg-primary-50 hover:text-ink"
                  )}
                >
                  <span className="flex h-[19px] w-[19px] shrink-0 items-center justify-center">
                    <item.icon />
                  </span>
                  <span>{item.label}</span>
                  {item.locked && (
                    <span className={clsx("flex items-center", active ? "text-card/60" : "text-muted-3")}>
                      <LockIcon />
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="ml-1 flex shrink-0 items-center gap-0.5 border-l border-border-soft pl-1">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition hover:bg-primary-50"
            >
              <InstagramIcon width={17} height={17} />
            </a>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition hover:bg-primary-50"
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
        const active = isActive(pathname, item.href);
        return (
          <Link prefetch={false}
            key={item.label}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            title={item.locked ? t.common.guestLockedTitle : undefined}
            style={{ bottom: `${86 + i * 54}px` }}
            className={clsx(
              "site-fab fixed right-4 z-30 flex h-11 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full border border-border bg-card py-0 pl-3 pr-4.5 text-[13.5px] font-bold shadow-[0_8px_20px_rgba(30,20,60,0.18)] transition-all duration-200 sm:hidden",
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

      {/* «Ilovani oʻrnatish» as the top pill of the phone menu (renders
          nothing when already installed or not installable). */}
      <InstallAppButton
        variant="menu"
        onDone={() => setMobileOpen(false)}
        style={{ bottom: `${86 + items.length * 54}px` }}
        className={clsx(
          "site-fab fixed right-4 z-30 h-11 shrink-0 whitespace-nowrap rounded-full border border-primary-200 bg-primary-50 pl-3.5 pr-4.5 text-[13.5px] font-bold text-primary-900 shadow-[0_8px_20px_rgba(30,20,60,0.18)] duration-200 sm:hidden",
          mobileOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2.5 opacity-0"
        )}
      />

      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={t.nav.home}
        className="site-fab fixed bottom-5 right-4 z-30 flex h-13 w-13 cursor-pointer items-center justify-center rounded-full bg-accent text-on-accent hover:bg-accent-hover shadow-[0_10px_24px_-12px_rgba(85,53,166,0.6)] transition hover:brightness-110 sm:hidden"
      >
        {mobileOpen ? <CloseIcon /> : <MenuIcon />}
      </button>
    </>
  );
}
