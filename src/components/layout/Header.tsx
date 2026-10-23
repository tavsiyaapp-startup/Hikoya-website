"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { BellIcon, SearchIcon } from "@/components/ui/icons";
import { UserMenu } from "@/components/layout/UserMenu";
import { ThemeSwitch } from "@/components/layout/ThemeSwitch";
import type { CurrentUser } from "@/lib/current-user";

export function Header({ user, unreadCount = 0 }: { user: CurrentUser | null; unreadCount?: number }) {
  const { locale, setLocale, t } = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(query ? `${ROUTES.search}?q=${encodeURIComponent(query)}` : ROUTES.search);
  }

  return (
    <header className="site-header sticky top-0 z-20 flex h-[64px] items-center gap-3 border-b border-border/70 bg-card/80 px-3 backdrop-blur-xl sm:h-[76px] sm:gap-5 sm:px-5 lg:gap-7 lg:px-8">
      <Link prefetch={false} href={ROUTES.home} className="flex shrink-0 items-center gap-2.5 lg:w-52 lg:gap-3">
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
          className="h-12 w-full rounded-full border border-border bg-surface pl-12 pr-4 text-[14.5px] text-ink outline-none transition placeholder:text-muted-3 focus:border-primary-400 focus:bg-card focus:ring-4 focus:ring-primary-400/20"
        />
      </form>

      <Link prefetch={false}
        href={ROUTES.search}
        aria-label={t.nav.search}
        className={clsx(
          "ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-ink-soft transition hover:bg-surface md:hidden",
          // Guests on the narrowest phones need the room for both sign-in
          // buttons; search stays in the floating menu (TopNav).
          !user && "max-[359px]:hidden"
        )}
      >
        <SearchIcon />
      </Link>

      <div className={clsx("flex items-center gap-1.5 sm:ml-auto sm:gap-2.5", !user && "max-[359px]:ml-auto")}>
        <div className="hidden gap-0.5 rounded-full border border-border bg-primary-50 p-[3px] xs:flex">
          {(["uz", "ru"] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              className={clsx(
                "h-8 cursor-pointer rounded-full px-3 text-[12.5px] font-bold transition",
                locale === code ? "bg-card text-primary-800 shadow-sm" : "text-muted"
              )}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>

        {user ? (
          <Link prefetch={false}
            href={`${ROUTES.author(user.profile?.username ?? "")}?tab=notifications`}
            title={t.nav.notifications}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-ink-soft transition hover:border-primary-200 sm:h-11 sm:w-11"
          >
            <BellIcon />
            {unreadCount > 0 && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger sm:right-2.5 sm:top-2.5" />
            )}
          </Link>
        ) : (
          // A guest has no notifications; the bell's place goes to the
          // light/dark switch (on phones it lives in the footer).
          <ThemeSwitch className="hidden sm:flex" />
        )}

        {user ? (
          <UserMenu user={user} />
        ) : (
          <>
            <Link prefetch={false} href={ROUTES.login}>
              <Button
                variant="secondary"
                size="sm"
                className="whitespace-nowrap px-3 sm:h-[46px] sm:px-5 sm:text-[14.5px]"
              >
                {t.common.login}
              </Button>
            </Link>
            <Link prefetch={false} href={ROUTES.onboarding}>
              <Button
                variant="primary"
                size="sm"
                className="whitespace-nowrap px-3 sm:h-[46px] sm:px-5 sm:text-[14.5px]"
              >
                {t.common.register}
              </Button>
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
