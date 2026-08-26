"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useMobileNav } from "@/components/layout/MobileNavContext";
import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { BellIcon, MenuIcon, SearchIcon } from "@/components/ui/icons";
import type { CurrentUser } from "@/lib/current-user";

export function Header({ user, unreadCount = 0 }: { user: CurrentUser | null; unreadCount?: number }) {
  const { locale, setLocale, t } = useLocale();
  const { setOpen } = useMobileNav();
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(query ? `${ROUTES.search}?q=${encodeURIComponent(query)}` : ROUTES.search);
  }

  return (
    <header className="sticky top-0 z-20 flex h-[64px] items-center gap-3 border-b border-border bg-white/92 px-3 backdrop-blur-md sm:h-[76px] sm:gap-5 sm:px-5 lg:gap-7 lg:px-8">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.nav.home}
        className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[12px] text-ink-soft transition hover:bg-surface lg:hidden"
      >
        <MenuIcon />
      </button>

      <Link href={ROUTES.home} className="flex shrink-0 items-center gap-2.5 lg:w-52 lg:gap-3">
        <Image src="/images/logo.png" alt="Hikoya" width={36} height={36} className="object-contain sm:h-11 sm:w-11" />
        <span className="hidden font-script text-[24px] leading-none text-ink sm:inline sm:text-[30px]">
          {t.common.brand}
        </span>
      </Link>

      <form onSubmit={handleSearchSubmit} className="relative mx-auto hidden max-w-[620px] flex-1 md:block">
        <SearchIcon className="pointer-events-none absolute left-[18px] top-[15px] text-muted-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.common.searchPlaceholder}
          className="h-12 w-full rounded-[14px] border border-border bg-surface pl-12 pr-4 text-[14.5px] text-ink outline-none transition focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(167,139,250,0.16)]"
        />
      </form>

      <Link
        href={ROUTES.search}
        aria-label={t.nav.search}
        className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-ink-soft transition hover:bg-surface md:hidden"
      >
        <SearchIcon />
      </Link>

      <div className="flex items-center gap-1.5 sm:ml-auto sm:gap-2.5">
        <div className="hidden gap-0.5 rounded-xl border border-border bg-primary-50 p-[3px] xs:flex">
          {(["ru", "uz"] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              className={clsx(
                "h-8 cursor-pointer rounded-[10px] px-3 text-[12.5px] font-bold transition",
                locale === code ? "bg-white text-primary-800 shadow-sm" : "text-muted"
              )}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>

        <Link
          href={user ? `${ROUTES.author(user.profile?.username ?? "")}?tab=notifications` : ROUTES.onboarding}
          title={user ? t.nav.notifications : t.common.guestLockedTitle}
          className={clsx(
            "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-border bg-white text-ink-soft transition sm:h-11 sm:w-11",
            !user && "cursor-not-allowed opacity-50"
          )}
        >
          <BellIcon />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger sm:right-2.5 sm:top-2.5" />
          )}
        </Link>

        {user ? (
          <Link href={ROUTES.author(user.profile?.username ?? "")} className="flex shrink-0 items-center gap-2">
            <Avatar name={user.profile?.display_name ?? "?"} src={user.profile?.avatar_url} size={38} />
          </Link>
        ) : (
          <>
            <Link href={ROUTES.login} className="hidden sm:block">
              <Button variant="secondary" size="sm" className="sm:h-[46px] sm:px-5 sm:text-[14.5px]">
                {t.common.login}
              </Button>
            </Link>
            <Link href={ROUTES.onboarding}>
              <Button variant="primary" size="sm" className="sm:h-[46px] sm:px-5 sm:text-[14.5px]">
                {t.common.register}
              </Button>
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
