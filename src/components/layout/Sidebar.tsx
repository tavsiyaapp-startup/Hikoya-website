"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useMobileNav } from "@/components/layout/MobileNavContext";
import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import {
  BoardIcon,
  BellIcon,
  CloseIcon,
  CollectionsIcon,
  HomeIcon,
  LibraryIcon,
  LockIcon,
  PlusIcon,
  SearchIcon,
  SidebarToggleIcon,
  UserIcon,
} from "@/components/ui/icons";
import type { CurrentUser } from "@/lib/current-user";

export function Sidebar({ user, unreadCount = 0 }: { user: CurrentUser | null; unreadCount?: number }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const { open, setOpen } = useMobileNav();
  const [expanded, setExpanded] = useState(true);

  const items = [
    { href: ROUTES.home, icon: HomeIcon, label: t.nav.home, locked: false, dot: false },
    { href: ROUTES.search, icon: SearchIcon, label: t.nav.search, locked: false, dot: false },
    { href: ROUTES.collections, icon: CollectionsIcon, label: t.nav.collections, locked: false, dot: false },
    { href: ROUTES.board, icon: BoardIcon, label: t.nav.board, locked: false, dot: false },
    {
      href: user ? ROUTES.create : ROUTES.onboarding,
      icon: PlusIcon,
      label: t.nav.create,
      locked: !user,
      dot: false,
    },
    {
      href: user ? "/library?tab=notifications" : ROUTES.onboarding,
      icon: BellIcon,
      label: t.nav.notifications,
      locked: !user,
      dot: unreadCount > 0,
    },
    {
      href: user ? ROUTES.library : ROUTES.onboarding,
      icon: LibraryIcon,
      label: t.nav.library,
      locked: !user,
      dot: false,
    },
    {
      href: user ? ROUTES.author(user.profile?.username ?? "") : ROUTES.onboarding,
      icon: UserIcon,
      label: t.nav.profile,
      locked: !user,
      dot: false,
    },
  ];

  return (
    <>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-hidden
        />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] shrink-0 flex-col overflow-y-auto border-r border-border bg-white px-3.5 py-5 transition-transform duration-200 lg:sticky lg:top-[76px] lg:z-auto lg:h-[calc(100vh-76px)] lg:translate-x-0 lg:transition-[width]",
          open ? "translate-x-0" : "-translate-x-full",
          expanded ? "lg:w-[248px]" : "lg:w-[76px]"
        )}
      >
        <button
          onClick={() => setOpen(false)}
          className="mb-4.5 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[11px] border border-border bg-surface text-ink-soft transition hover:bg-primary-50 lg:hidden"
        >
          <CloseIcon />
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mb-4.5 hidden h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[11px] border border-border bg-surface text-ink-soft transition hover:bg-primary-50 lg:flex"
        >
          <SidebarToggleIcon />
        </button>

        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const active = pathname === item.href.split("?")[0];
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                title={item.locked ? t.common.guestLockedTitle : undefined}
                className={clsx(
                  "flex h-11 items-center gap-3 rounded-[12px] px-3 text-[14px] font-semibold transition",
                  active ? "bg-primary-50 text-primary-900" : "text-ink-soft hover:bg-surface"
                )}
              >
                <span className="relative flex h-[22px] w-[22px] shrink-0 items-center justify-center">
                  <item.icon />
                  {item.dot && <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-danger" />}
                </span>
                {expanded && <span className="overflow-hidden whitespace-nowrap">{item.label}</span>}
                {item.locked && expanded && (
                  <span className="ml-auto flex items-center text-muted-3">
                    <LockIcon />
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {expanded && !user && (
          <div className="mt-6.5 rounded-[18px] border border-primary-100 bg-linear-to-br from-primary-50 to-pink-bg p-4.5">
            <div className="mb-1.5 text-[14px] font-extrabold leading-snug">{t.sidebar.title}</div>
            <div className="mb-3.5 text-[12.5px] leading-relaxed text-muted">{t.sidebar.body}</div>
            <Link href={ROUTES.onboarding} onClick={() => setOpen(false)}>
              <Button variant="primary" size="sm" className="w-full justify-center">
                {t.sidebar.cta}
              </Button>
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
