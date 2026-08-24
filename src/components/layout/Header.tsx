"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { BellIcon, SearchIcon } from "@/components/ui/icons";
import type { CurrentUser } from "@/lib/current-user";

export function Header({ user }: { user: CurrentUser | null }) {
  const { locale, setLocale, t } = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(query ? `${ROUTES.search}?q=${encodeURIComponent(query)}` : ROUTES.search);
  }

  return (
    <header className="sticky top-0 z-20 flex h-[76px] items-center gap-7 border-b border-border bg-white/92 px-8 backdrop-blur-md">
      <Link href={ROUTES.home} className="flex w-52 shrink-0 items-center gap-3">
        <Image src="/images/logo.png" alt="Hikoya" width={44} height={44} className="object-contain" />
        <span className="font-script text-[30px] leading-none text-ink">{t.common.brand}</span>
      </Link>

      <form onSubmit={handleSearchSubmit} className="relative mx-auto max-w-[620px] flex-1">
        <SearchIcon className="pointer-events-none absolute left-[18px] top-[15px] text-muted-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.common.searchPlaceholder}
          className="h-12 w-full rounded-[14px] border border-border bg-surface pl-12 pr-4 text-[14.5px] text-ink outline-none transition focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(167,139,250,0.16)]"
        />
      </form>

      <div className="ml-auto flex items-center gap-2.5">
        <div className="flex gap-0.5 rounded-xl border border-border bg-primary-50 p-[3px]">
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
          href={user ? "/library?tab=notifications" : ROUTES.onboarding}
          title={user ? t.nav.notifications : t.common.guestLockedTitle}
          className={clsx(
            "flex h-11 w-11 items-center justify-center rounded-[13px] border border-border bg-white text-ink-soft transition",
            !user && "cursor-not-allowed opacity-50"
          )}
        >
          <BellIcon />
        </Link>

        {user ? (
          <Link href={ROUTES.author(user.profile?.username ?? "")} className="flex items-center gap-2">
            <Avatar name={user.profile?.display_name ?? "?"} src={user.profile?.avatar_url} size={40} />
          </Link>
        ) : (
          <>
            <Link href={ROUTES.onboarding}>
              <Button variant="secondary">{t.common.login}</Button>
            </Link>
            <Link href={ROUTES.onboarding}>
              <Button variant="primary">{t.common.register}</Button>
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
