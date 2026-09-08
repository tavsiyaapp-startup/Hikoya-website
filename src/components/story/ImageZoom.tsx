"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { CloseIcon } from "@/components/ui/icons";

// Wraps arbitrary trigger content (children) in a button that opens a
// full-screen preview of `src` on click, instead of whatever the trigger
// would otherwise do (e.g. sit inside a card that links elsewhere) — shared
// by every cover image on the site (story cards, the story page's own
// cover) so they all behave the same way.
export function ImageZoom({
  src,
  alt,
  triggerClassName,
  children,
}: {
  src: string;
  alt: string;
  triggerClassName?: string;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={alt}
        className={triggerClassName}
      >
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t.common.close}
            className="absolute right-4 top-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <CloseIcon width={20} height={20} />
          </button>
          <div className="relative aspect-[3/4] max-h-[85vh] w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Image src={src} alt={alt} fill sizes="90vw" className="rounded-[12px] object-contain" />
          </div>
        </div>
      )}
    </>
  );
}
