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
        {slides.map((slide, i) => (
          <div key={slide.id} className="w-full shrink-0">
            <Slide slide={slide} locale={locale} isFirst={i === 0} />
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
function Slide({ slide, locale, isFirst }: { slide: HeroSlide; locale: "ru" | "uz"; isFirst: boolean }) {
  const title = locale === "uz" ? slide.title_uz : slide.title_ru;
  const body = locale === "uz" ? slide.body_uz : slide.body_ru;
  const ctaLabel = locale === "uz" ? slide.cta_label_uz : slide.cta_label_ru;
  const hasText = Boolean(title || body);
  const hasImage = Boolean(slide.image_url);

  return (
    <div className="flex h-[460px] flex-col border border-primary-100 bg-linear-to-br from-primary-50 via-[#F6ECFB] to-pink-bg dark:via-[#2A2044] sm:h-90 sm:flex-row">
      {hasText && !hasImage && (
        // Photo-less slide = a personal note, not a promo blurb — dressed up
        // like an actual letter: a soft floating card instead of bare text
        // on the gradient, a big decorative opening quote mark, the brand's
        // script wordmark font on the heading (used everywhere else only
        // for "Hikoya" itself) for a handwritten, intimate feel, and a
        // blockquote-style left rule on the body.
        <div className="flex flex-1 items-center overflow-y-auto p-4 sm:p-6">
          <div className="relative mx-auto w-full max-w-[640px] overflow-hidden rounded-[24px] bg-white/55 p-5 ring-1 ring-white/70 backdrop-blur-[2px] dark:bg-white/[0.05] dark:ring-white/10 sm:p-7">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-1 left-2 select-none font-serif text-[70px] italic leading-none text-primary-300/60 dark:text-primary-700/40 sm:left-3 sm:text-[100px]"
            >
              &ldquo;
            </span>
            <div className="relative">
              {title && (
                <h1 className="font-script mb-2 max-w-[560px] text-balance text-[22px] leading-tight text-primary-800 sm:text-[32px]">
                  {title}
                </h1>
              )}
              {body && (
                <p className="max-w-[560px] whitespace-pre-line border-l-2 border-primary-300 pl-3.5 text-[13px] leading-[1.55] text-ink-soft dark:border-primary-700 sm:pl-4 sm:text-[14px]">
                  {body}
                </p>
              )}
              {ctaLabel && slide.cta_url && (
                <Link href={slide.cta_url} className="mt-4 inline-block">
                  <Button size="lg">{ctaLabel}</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
      {hasText && hasImage && (
        <div className="flex flex-1 flex-col justify-center overflow-y-auto p-6 sm:p-11">
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
      {hasImage && (
        <div
          className={clsx(
            "relative w-full",
            hasText ? "h-48 sm:h-full sm:w-[46%]" : "h-full w-full"
          )}
        >
          {/* Separate mobile/desktop sources, swapped by breakpoint (same sm
              cutoff the rest of this layout already uses) rather than a
              single image stretched across both — image_url_mobile falls
              back to image_url when a slide never got its own mobile crop.
              sizes matches this box's actual rendered width so the browser
              doesn't fetch a full-viewport-sized image for a 46%-wide slot;
              priority (+ fetchPriority) only on slide 1, since it's the
              carousel's likely LCP element and Next's own guidance is to
              never mark more than one image priority on a page. */}
          <Image
            src={(slide.image_url_mobile || slide.image_url) as string}
            alt=""
            fill
            sizes="100vw"
            priority={isFirst}
            fetchPriority={isFirst ? "high" : undefined}
            className={clsx("object-cover sm:hidden", hasText ? "object-right" : "object-center")}
          />
          <Image
            src={slide.image_url as string}
            alt=""
            fill
            sizes={hasText ? "46vw" : "100vw"}
            priority={isFirst}
            fetchPriority={isFirst ? "high" : undefined}
            className={clsx("hidden object-cover sm:block", hasText ? "object-right" : "object-center")}
          />
          {hasText && <div className="absolute inset-0 bg-linear-to-r from-primary-50 to-transparent sm:block hidden" />}
        </div>
      )}
    </div>
  );
}
