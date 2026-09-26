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

      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={t.nav.home}
          className="fixed bottom-5 right-4 z-30 flex h-13 w-13 cursor-pointer items-center justify-center rounded-full bg-linear-to-br from-[#6D28D9] to-[#9333EA] text-white shadow-[0_10px_24px_rgba(109,40,217,0.35)] transition hover:brightness-110 sm:hidden"
        >
          <MenuIcon />
        </button>
      )}

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 sm:hidden"
          aria-hidden
        />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col overflow-y-auto border-r border-border bg-card px-3.5 py-5 transition-transform duration-200 sm:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="mb-4.5 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[11px] border border-border bg-surface text-ink-soft transition hover:bg-primary-50"
        >
          <CloseIcon />
        </button>

        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const active = pathname === item.href.split("?")[0];
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={item.locked ? t.common.guestLockedTitle : undefined}
                className={clsx(
                  "flex h-11 items-center gap-3 rounded-[12px] px-3 text-[14px] font-semibold transition",
                  active ? "bg-primary-50 text-primary-900" : "text-ink-soft hover:bg-surface"
                )}
              >
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center">
                  <item.icon />
                </span>
                <span className="overflow-hidden whitespace-nowrap">{item.label}</span>
                {item.locked && (
                  <span className="ml-auto flex items-center text-muted-3">
                    <LockIcon />
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 flex items-center gap-1.5 border-t border-border-soft pt-4">
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
      </aside>
    </>
  );
}
