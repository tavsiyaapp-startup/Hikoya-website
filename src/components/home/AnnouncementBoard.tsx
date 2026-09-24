import Image from "next/image";
import { getServerLocale } from "@/lib/i18n/locale-server";
import type { Announcement } from "@/types/database";

// Up to 2 small cards beside the hero (the query already caps it to 2) —
// stacked to match the hero's height from sm up, side by side below it on
// mobile where there's no room next to a full-width hero. Plain, not a
// link: admin only supplies an image and/or text, no CTA was asked for.
export async function AnnouncementBoard({ announcements }: { announcements: Announcement[] }) {
  if (announcements.length === 0) return null;

  const locale = await getServerLocale();

  return (
    <div className="flex gap-4 sm:h-full sm:w-[260px] sm:shrink-0 sm:flex-col lg:w-[300px]">
      {announcements.map((announcement) => {
        const text = locale === "uz" ? announcement.text_uz : announcement.text_ru;
        return (
          <div
            key={announcement.id}
            className="relative min-h-[140px] flex-1 overflow-hidden rounded-[18px] border border-primary-100 bg-linear-to-br from-primary-50 via-[#F6ECFB] to-pink-bg dark:via-[#2A2044]"
          >
            {announcement.image_url && (
              <Image src={announcement.image_url} alt="" fill sizes="300px" className="object-cover" />
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
  );
}
