"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";
import {
  BoardIcon,
  CollectionsIcon,
  HomeIcon,
  LibraryIcon,
  LockIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
} from "@/components/ui/icons";
import type { CurrentUser } from "@/lib/current-user";

export function TopNav({ user }: { user: CurrentUser | null }) {
  const { t } = useLocale();
  const pathname = usePathname();

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
    // z-20, same tier as Header: in-page content (e.g. StoryCard's status
    // ribbon) uses z-10, and with equal z-index the later-in-DOM content
    // would paint over this sticky bar once it scrolls underneath it.
    <nav className="sticky top-[64px] z-20 border-b border-border bg-card/92 backdrop-blur-md sm:top-[76px]">
      <div className="overflow-x-auto px-3 sm:px-5 lg:px-8">
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
  );
}
