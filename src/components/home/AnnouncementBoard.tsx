"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { Announcement } from "@/types/database";

const AUTO_ADVANCE_MS = 6000;

// Every announcement gets the board's full fixed height to itself — sm:h-[300px]
// matches HeroCarousel's own fixed sm:h-[300px], so "the banner and the board
// are level" holds by construction, not as a side effect of flex-stretch.
// Width is still a flex-grow share (sm:flex-1 against the hero wrapper's
// sm:flex-[3] in page.tsx — a 3:1 ratio, ~25% of the row), so it scales with
// viewport width.
//
// More than one announcement paginates one at a time: a vertical carousel
// (translateY, mirroring HeroCarousel's horizontal translateX) auto-advances
// through them, each filling the full fixed height — no splitting the board
// between two half-height cards, so there's always full room for the text.
export function AnnouncementBoard({ announcements }: { announcements: Announcement[] }) {
  const { locale } = useLocale();
  const total = announcements.length;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % total), AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [total]);

  if (total === 0) return null;

  return (
    <div className="h-[128px] overflow-hidden sm:h-[300px] sm:min-w-0 sm:flex-1">
      <div
        className="flex h-full flex-col transition-transform duration-500 ease-out"
        style={{ transform: `translateY(-${index * 100}%)` }}
      >
        {announcements.map((announcement) => {
          const text = locale === "uz" ? announcement.text_uz : announcement.text_ru;
          const cardClassName =
            "relative h-full shrink-0 overflow-hidden rounded-[18px] border border-primary-100 bg-linear-to-br from-primary-50 via-[#F6ECFB] to-pink-bg dark:via-[#2A2044]";
          const cardContent = (
            <>
              {announcement.image_url && (
                <Image
                  src={announcement.image_url}
                  alt=""
                  fill
                  sizes="(max-width: 639px) 90vw, 25vw"
                  className="object-cover"
                />
              )}
              {text && (
                <div
                  className={
                    announcement.image_url
                      ? "absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-3.5 pt-8"
                      : "absolute inset-0 flex items-center p-3.5"
                  }
                >
                  <p
                    className={
                      announcement.image_url
                        ? "line-clamp-3 text-[13.5px] font-bold leading-snug text-white"
                        : "line-clamp-4 text-[13.5px] font-bold leading-snug text-primary-900 sm:line-clamp-8"
                    }
                  >
                    {text}
                  </p>
                </div>
              )}
            </>
          );
          // The whole card becomes a link when staff set one, same as
          // hero_slides' cta_url — no separate button, since a small
          // announcement card has no room for one.
          return announcement.link_url ? (
            <Link key={announcement.id} href={announcement.link_url} className={cardClassName}>
              {cardContent}
            </Link>
          ) : (
            <div key={announcement.id} className={cardClassName}>
              {cardContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}
