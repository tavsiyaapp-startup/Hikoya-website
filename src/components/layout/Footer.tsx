"use client";

import Link from "next/link";
import Image from "next/image";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";
import { SendIcon, InstagramIcon } from "@/components/ui/icons";

const TELEGRAM_SUPPORT_URL = `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}`;

export function Footer() {
  const { t } = useLocale();

  return (
    <footer className="mt-14 border-t border-border bg-card">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-10 sm:flex-row sm:justify-between sm:px-6 lg:px-9">
        <div className="flex max-w-[320px] flex-col gap-2.5">
          <Link href={ROUTES.home} className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="" width={30} height={30} className="object-contain" />
            <span className="font-script text-[22px] leading-none text-ink">{t.common.brand}</span>
          </Link>
          <p className="text-[13px] leading-relaxed text-muted-2">{t.footer.tagline}</p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:flex sm:gap-16">
          <div className="flex flex-col gap-2.5">
            <div className="text-[12px] font-bold uppercase tracking-wide text-muted-3">{t.footer.aboutTitle}</div>
            <Link href={ROUTES.mission} className="text-[13.5px] font-semibold text-ink-soft transition hover:text-primary-800">
              {t.footer.mission}
            </Link>
            <Link href={ROUTES.rules} className="text-[13.5px] font-semibold text-ink-soft transition hover:text-primary-800">
              {t.footer.rules}
            </Link>
            <Link href={ROUTES.news} className="text-[13.5px] font-semibold text-ink-soft transition hover:text-primary-800">
              {t.footer.news}
            </Link>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="text-[12px] font-bold uppercase tracking-wide text-muted-3">{t.footer.contactTitle}</div>
            <a
              href={TELEGRAM_SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-soft transition hover:text-primary-800"
            >
              <SendIcon width={15} height={15} />
              {t.footer.telegramSupport}
            </a>
            <span
              title={t.footer.instagramSoon}
              className="flex cursor-not-allowed items-center gap-2 text-[13.5px] font-semibold text-muted opacity-60"
            >
              <InstagramIcon width={15} height={15} />
              {t.footer.instagram}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-border-soft px-4 py-4 text-center text-[12px] text-muted-3 sm:px-6 lg:px-9">
        © {new Date().getFullYear()} {t.common.brand}
      </div>
    </footer>
  );
}
