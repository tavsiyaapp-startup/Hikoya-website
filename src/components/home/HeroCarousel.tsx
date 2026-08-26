"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import type { HeroSlide } from "@/types/database";

const AUTO_ADVANCE_MS = 7000;

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
            className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/85 text-ink-soft shadow-[0_4px_14px_rgba(60,40,120,0.16)] hover:bg-white"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/85 text-ink-soft shadow-[0_4px_14px_rgba(60,40,120,0.16)] hover:bg-white"
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
                  i === index ? "w-6 bg-primary-700" : "w-2 bg-white/70 hover:bg-white"
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
// banner instead of sharing it with a text panel.
function Slide({ slide, locale }: { slide: HeroSlide; locale: "ru" | "uz" }) {
  const title = locale === "uz" ? slide.title_uz : slide.title_ru;
  const body = locale === "uz" ? slide.body_uz : slide.body_ru;
  const ctaLabel = locale === "uz" ? slide.cta_label_uz : slide.cta_label_ru;
  const hasText = Boolean(title || body);

  return (
    <div className="flex h-[460px] flex-col border border-primary-100 bg-linear-to-br from-primary-50 via-[#F6ECFB] to-pink-bg sm:h-90 sm:flex-row">
      {hasText && (
        <div className="flex flex-1 flex-col justify-center p-6 sm:p-11">
          {title && (
            <h1 className="mb-3 line-clamp-2 max-w-[480px] text-[28px] font-extrabold leading-tight tracking-tight text-balance sm:text-[40px]">
              {title}
            </h1>
          )}
          {body && (
            <p className="mb-6.5 line-clamp-3 max-w-[430px] text-[14.5px] leading-relaxed text-ink-soft sm:text-[15.5px]">
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
      <div
        className={clsx(
          "relative w-full",
          hasText ? "h-48 sm:h-full sm:w-[46%]" : "h-full w-full"
        )}
      >
        <Image
          src={slide.image_url}
          alt=""
          fill
          className={clsx("object-cover", hasText ? "object-right" : "object-center")}
        />
        {hasText && <div className="absolute inset-0 bg-linear-to-r from-primary-50 to-transparent sm:block hidden" />}
      </div>
    </div>
  );
}
