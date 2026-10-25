"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { Announcement } from "@/types/database";

const AUTO_ADVANCE_MS = 6000;

// Every announcement gets the board's full fixed height to itself — sm:h-[248px]
// matches HeroCarousel's own fixed sm:h-[248px], so "the banner and the board
// are level" holds by construction, not as a side effect of flex-stretch.
// Width is still a flex-grow share (sm:flex-1 against the hero wrapper's
// sm:flex-[3] in page.tsx — a 3:1 ratio, ~25% of the row), so it scales with
// viewport width.
//
// More than one announcement paginates one at a time: a vertical carousel
// (translateY, mirroring HeroCarousel's horizontal translateX) auto-advances
// through them, each filling the full fixed height — no splitting the board
// between two half-height cards, so there's always full room for the text.
export function AnnouncementBoard({ announcements: all }: { announcements: Announcement[] }) {
  const { locale } = useLocale();
  // Same as HeroCarousel: a card with neither a (still existing) picture
  // nor text would show as an empty box — leave it out.
  const announcements = all.filter((a) => a.image_url || a.text_uz || a.text_ru);
  const total = announcements.length;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % total), AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [total]);

  if (total === 0) return null;

  return (
    <div className="h-[120px] overflow-hidden rounded-[22px] shadow-[0_24px_50px_-30px_rgba(45,31,85,0.45)] sm:h-[248px] sm:min-w-0 sm:flex-1">
      <div
        className="flex h-full flex-col transition-transform duration-700"
        style={{ transform: `translateY(-${index * 100}%)` }}
      >
        {announcements.map((announcement) => {
          const text = locale === "uz" ? announcement.text_uz : announcement.text_ru;
          const cardClassName =
            "relative h-full shrink-0 overflow-hidden rounded-[22px] bg-card bg-[radial-gradient(40rem_18rem_at_0%_0%,var(--color-primary-100),transparent_70%),radial-gradient(30rem_16rem_at_100%_100%,var(--color-pink-bg),transparent_70%)] ring-1 ring-inset ring-border";
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
                      : "absolute inset-0 flex items-center p-4 sm:p-5"
                  }
                >
                  <p
                    className={
                      announcement.image_url
                        ? "line-clamp-3 text-[13.5px] font-bold leading-snug text-white"
                        : "line-clamp-3 whitespace-pre-line text-[13.5px] font-semibold leading-snug text-ink sm:line-clamp-8"
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
            <Link prefetch={false} key={announcement.id} href={announcement.link_url} className={cardClassName}>
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
