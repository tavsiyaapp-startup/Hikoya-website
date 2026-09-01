"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import type { HeroSlide } from "@/types/database";

const AUTO_ADVANCE_MS = 15000;

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const { locale } = useLocale();
  const total = slides.length;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % total), AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [total]);

  function go(next: number) {
    setIndex(((next % total) + total) % total);
  }

  if (total === 0) return null;

  return (
    <section className="relative mb-9.5 overflow-hidden rounded-[26px]">
      <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((slide) => (
          <div key={slide.id} className="w-full shrink-0">
            <Slide slide={slide} locale={locale} />
          </div>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/85 text-ink-soft shadow-[0_4px_14px_rgba(60,40,120,0.16)] hover:bg-card dark:bg-ink-darker/60 dark:hover:bg-ink-darker/85"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/85 text-ink-soft shadow-[0_4px_14px_rgba(60,40,120,0.16)] hover:bg-card dark:bg-ink-darker/60 dark:hover:bg-ink-darker/85"
          >
            <ChevronRightIcon />
          </button>
          <div className="absolute bottom-3.5 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={clsx(
                  "h-2 cursor-pointer rounded-full transition-all",
                  i === index ? "w-6 bg-[#7C3AED]" : "w-2 bg-white/70 hover:bg-card dark:bg-ink-darker/60 dark:hover:bg-ink-darker/85"
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// Every slide shares this exact layout so the carousel never changes size
// between slides — only the fixed h-[...] values below vary by breakpoint.
// Title/body are optional: with neither set, the image fills the whole
// banner instead of sharing it with a text panel. image_url is optional
// too: without one, the text panel fills the whole banner on the shared
// gradient background instead of sharing it with an image half — no clamp
// on the text in that case, since a photo-less slide exists specifically to
// carry a longer message (e.g. a note from the platform's creators).
function Slide({ slide, locale }: { slide: HeroSlide; locale: "ru" | "uz" }) {
  const title = locale === "uz" ? slide.title_uz : slide.title_ru;
  const body = locale === "uz" ? slide.body_uz : slide.body_ru;
  const ctaLabel = locale === "uz" ? slide.cta_label_uz : slide.cta_label_ru;
  const hasText = Boolean(title || body);
  const hasImage = Boolean(slide.image_url);

  return (
    <div className="flex h-[460px] flex-col border border-primary-100 bg-linear-to-br from-primary-50 via-[#F6ECFB] to-pink-bg dark:via-[#2A2044] sm:h-90 sm:flex-row">
      {hasText && (
        <div className="flex flex-1 flex-col justify-center overflow-y-auto p-6 sm:p-11">
          {title && (
            <h1
              className={clsx(
                "mb-3 max-w-[480px] text-[28px] font-extrabold leading-tight tracking-tight text-balance sm:text-[40px]",
                hasImage ? "line-clamp-2" : "max-w-[640px] text-[24px] sm:text-[32px]"
              )}
            >
              {title}
            </h1>
          )}
          {body && (
            <p
              className={clsx(
                "mb-6.5 whitespace-pre-line text-ink-soft",
                hasImage
                  ? "line-clamp-3 max-w-[430px] text-[14.5px] leading-relaxed sm:text-[15.5px]"
                  : "max-w-[620px] text-[13.5px] leading-[1.6] sm:text-[14.5px]"
              )}
            >
              {body}
            </p>
          )}
          {ctaLabel && slide.cta_url && (
            <Link href={slide.cta_url}>
              <Button size="lg">{ctaLabel}</Button>
            </Link>
          )}
        </div>
      )}
      {hasImage && (
        <div
          className={clsx(
            "relative w-full",
            hasText ? "h-48 sm:h-full sm:w-[46%]" : "h-full w-full"
          )}
        >
          <Image
            src={slide.image_url as string}
            alt=""
            fill
            className={clsx("object-cover", hasText ? "object-right" : "object-center")}
          />
          {hasText && <div className="absolute inset-0 bg-linear-to-r from-primary-50 to-transparent sm:block hidden" />}
        </div>
      )}
    </div>
  );
}
