"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { Announcement } from "@/types/database";

const AUTO_ADVANCE_MS = 6000;

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

// Each card has a fixed height (not derived from however many announcements
// exist) — sm:h-[300px] matches HeroCarousel's own fixed sm:h-[300px], so
// "the banner's height = two announcements' height" holds by construction,
// not as an accidental side effect of flex-stretch. Width is still a flex-grow
// share (sm:flex-1 against the hero wrapper's sm:flex-[3] in page.tsx — a
// 3:1 ratio, ~25% of the row), so it scales with viewport width.
//
// More than 2 announcements paginate: a vertical carousel (translateY,
// mirroring HeroCarousel's horizontal translateX) auto-advances through
// pages of up to 2 at a time, each page filling the full fixed height — a
// lone leftover announcement on the last page gets that whole height to
// itself instead of being squeezed into half of it.
export function AnnouncementBoard({ announcements }: { announcements: Announcement[] }) {
  const { locale } = useLocale();
  const pages = chunk(announcements, 2);
  const total = pages.length;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % total), AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [total]);

  if (announcements.length === 0) return null;

  return (
    <div className="h-[128px] overflow-hidden sm:h-[300px] sm:min-w-0 sm:flex-1">
      <div
        className="flex h-full flex-col transition-transform duration-500 ease-out"
        style={{ transform: `translateY(-${index * 100}%)` }}
      >
        {pages.map((page, i) => (
          <div key={i} className="flex h-full shrink-0 gap-4 sm:flex-col">
            {page.map((announcement) => {
              const text = locale === "uz" ? announcement.text_uz : announcement.text_ru;
              return (
                <div
                  key={announcement.id}
                  className="relative h-full flex-1 overflow-hidden rounded-[18px] border border-primary-100 bg-linear-to-br from-primary-50 via-[#F6ECFB] to-pink-bg dark:via-[#2A2044]"
                >
                  {announcement.image_url && (
                    <Image
                      src={announcement.image_url}
                      alt=""
                      fill
                      sizes="(max-width: 639px) 50vw, 25vw"
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
                            ? "line-clamp-2 text-[13.5px] font-bold leading-snug text-white"
                            : "line-clamp-4 text-[13.5px] font-bold leading-snug text-primary-900"
                        }
                      >
                        {text}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
