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
  LibraryIcon,
  LockIcon,
  MenuIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
} from "@/components/ui/icons";
import type { CurrentUser } from "@/lib/current-user";

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
          would paint over this sticky bar once it scrolls underneath it. */}
      <nav className="sticky top-[64px] z-20 border-b border-border bg-card/92 backdrop-blur-md sm:top-[76px]">
        {/* Below sm, a horizontally-scrolled row of 7 labeled items was too
            cramped — a hamburger opening the same items as a vertical list
            reads better at phone width. From sm up, screen is wide enough
            for the row itself, no drawer needed. */}
        <div className="flex h-13 items-center px-3 sm:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={t.nav.home}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[12px] text-ink-soft transition hover:bg-surface"
          >
            <MenuIcon />
          </button>
        </div>

        <div className="hidden overflow-x-auto px-5 sm:block lg:px-8">
          {/* w-fit + mx-auto (not justify-center) so the item group stays
              centered when it fits, but on narrow screens where it overflows,
              auto margins collapse to 0 and both ends stay reachable by
              scroll — justify-center would clip the start on overflow. */}
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
      </nav>

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
      </aside>
    </>
  );
}
