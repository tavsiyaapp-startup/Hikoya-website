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

export function HeroCarousel({ slides: allSlides }: { slides: HeroSlide[] }) {
  const { locale } = useLocale();
  // A slide whose picture was lost (old Supabase storage, see
  // lib/images.ts) and that has no text would be an empty box — skip it.
  const slides = allSlides.filter((s) => s.image_url || s.title_uz || s.title_ru || s.body_uz || s.body_ru);
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
    // mb-9.5 lives on the wrapping row in page.tsx now, not here — the hero
    // no longer always owns the full row by itself (AnnouncementBoard can
    // sit beside it).
    <section className="relative overflow-hidden rounded-[24px] shadow-[0_24px_50px_-30px_rgba(45,31,85,0.45)]">
      <div className="flex transition-transform duration-700" style={{ transform: `translateX(-${index * 100}%)` }}>
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
            className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-card/80 text-ink-soft ring-1 ring-border backdrop-blur-md transition hover:bg-card"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-card/80 text-ink-soft ring-1 ring-border backdrop-blur-md transition hover:bg-card"
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
                  i === index ? "w-6 bg-accent" : "w-2 bg-ink/20 hover:bg-ink/40"
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
// sm:h-[248px] matches AnnouncementBoard's own fixed sm:h-[248px] (2
// stacked cards + the gap between them) — keep these two in sync if either
// ever changes, so the hero and the board stay level side by side. Below
// sm the hero and board aren't side by side (board moves below it), so
// h-[168px] is deliberately not a 1:1 match to the board's own h-[120px]
// mobile height — it's 1.5x that on purpose. The mobile height is still
// tight for a hasText && hasImage slide (title/body text panels already
// scroll internally via overflow-y-auto if they don't fit; the image
// height below is shrunk to leave it room).
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
    <div className="flex h-[168px] flex-col overflow-hidden rounded-[24px] bg-card bg-[radial-gradient(40rem_18rem_at_0%_0%,var(--color-primary-100),transparent_70%),radial-gradient(30rem_16rem_at_100%_100%,var(--color-pink-bg),transparent_70%)] ring-1 ring-inset ring-border sm:h-[248px] sm:flex-row">
      {hasText && !hasImage && (
        // Photo-less slide = a personal note, not a promo blurb — dressed up
        // like an actual letter: a soft floating card instead of bare text
        // on the gradient, a big decorative opening quote mark, the brand's
        // script wordmark font on the heading (used everywhere else only
        // for "Hikoya" itself) for a handwritten, intimate feel, and a
        // blockquote-style left rule on the body.
        <div className="flex flex-1 items-center overflow-y-auto p-3.5 sm:p-5">
          <div className="relative mx-auto w-full max-w-[680px] overflow-hidden rounded-[18px] bg-card/70 p-4 ring-1 ring-border/70 dark:bg-white/[0.04] sm:p-6">
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
                <Link prefetch={false} href={slide.cta_url} className="mt-4 inline-block">
                  <Button size="lg">{ctaLabel}</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
      {hasText && hasImage && (
        <div className="flex flex-1 flex-col justify-center overflow-y-auto p-5 sm:p-9">
          {title && (
            <h1 className="mb-2.5 line-clamp-2 max-w-[480px] font-display text-[24px] font-bold leading-tight tracking-tight text-balance sm:text-[34px]">
              {title}
            </h1>
          )}
          {body && (
            <p className="mb-5 line-clamp-2 max-w-[430px] text-[14px] leading-relaxed text-ink-soft sm:text-[15px]">
              {body}
            </p>
          )}
          {ctaLabel && slide.cta_url && (
            <Link prefetch={false} href={slide.cta_url}>
              <Button size="lg">{ctaLabel}</Button>
            </Link>
          )}
        </div>
      )}
      {hasImage && (
        <div
          className={clsx(
            "relative w-full",
            hasText ? "h-20 sm:h-full sm:w-[46%]" : "h-full w-full"
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
          {hasText && <div className="absolute inset-0 hidden bg-linear-to-r from-card to-transparent sm:block" />}
        </div>
      )}
    </div>
  );
}
