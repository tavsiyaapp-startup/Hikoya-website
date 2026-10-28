"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { CloseIcon } from "@/components/ui/icons";

// Makes images embedded in a chapter's HTML open full-screen on tap, the
// same idea as cover images (ImageZoom) — authors often post character
// sheets / profiles as images that are shrunk too small to read inline.
// The chapter body is injected as raw HTML (dangerouslySetInnerHTML in both
// ReaderContent and BookReader), so individual <img> tags can't be wrapped
// in a React component; one delegated listener on #chapter-text handles them
// all. It renders nothing until an image is opened.
export function ChapterImageZoom() {
  const { t } = useLocale();
  const [img, setImg] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    const root = document.getElementById("chapter-text");
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("img");
      if (!(el instanceof HTMLImageElement) || !root.contains(el)) return;
      // Capture phase + stop: in the book reader a tap otherwise bubbles to
      // the page-turn handler on the wrapper (BookReader onPageClick).
      e.preventDefault();
      e.stopPropagation();
      setImg({ src: el.currentSrc || el.src, alt: el.alt || "" });
    };
    root.addEventListener("click", onClick, true);
    return () => root.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!img) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setImg(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [img]);

  if (!img) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      onClick={() => setImg(null)}
    >
      <button
        type="button"
        onClick={() => setImg(null)}
        aria-label={t.common.close}
        className="absolute right-4 top-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <CloseIcon width={20} height={20} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- author-embedded image of unknown size/ratio, shown as-is */}
      <img
        src={img.src}
        alt={img.alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-full rounded-[12px] object-contain"
      />
    </div>,
    document.body
  );
}
