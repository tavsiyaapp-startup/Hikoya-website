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

export function HeroCarousel({ slides, children }: { slides: HeroSlide[]; children: React.ReactNode }) {
  const { locale } = useLocale();
  const total = 1 + slides.length;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % total), AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [total]);

  function go(next: number) {
    setIndex(((next % total) + total) % total);
  }

  return (
    <section className="relative mb-9.5 overflow-hidden rounded-[26px]">
      <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        <div className="w-full shrink-0">{children}</div>
        {slides.map((slide) => (
          <div key={slide.id} className="w-full shrink-0">
            <GenericSlide slide={slide} locale={locale} />
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

function GenericSlide({ slide, locale }: { slide: HeroSlide; locale: "ru" | "uz" }) {
  const title = locale === "uz" ? slide.title_uz : slide.title_ru;
  const body = locale === "uz" ? slide.body_uz : slide.body_ru;
  const ctaLabel = locale === "uz" ? slide.cta_label_uz : slide.cta_label_ru;

  return (
    <div className="flex flex-col border border-primary-100 bg-linear-to-br from-primary-50 via-[#F6ECFB] to-pink-bg sm:flex-row">
      <div className="flex-1 p-6 sm:p-11">
        <h1 className="mb-3 max-w-[480px] text-[28px] font-extrabold leading-tight tracking-tight text-balance sm:text-[40px]">
          {title}
        </h1>
        <p className="mb-6.5 max-w-[430px] text-[14.5px] leading-relaxed text-ink-soft sm:text-[15.5px]">{body}</p>
        {ctaLabel && slide.cta_url && (
          <Link href={slide.cta_url}>
            <Button size="lg">{ctaLabel}</Button>
          </Link>
        )}
      </div>
      <div className="relative h-48 w-full sm:h-auto sm:min-h-75 sm:w-[46%]">
        <Image src={slide.image_url} alt="" fill className="object-cover object-right" />
        <div className="absolute inset-0 bg-linear-to-r from-primary-50 to-transparent sm:block hidden" />
      </div>
    </div>
  );
}
