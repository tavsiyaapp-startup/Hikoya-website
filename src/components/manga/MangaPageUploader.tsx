"use client";

import { useCallback, useRef, useState } from "react";
import { resizeImageFile } from "@/lib/image-resize";
import {
  MAX_FILE_MB,
  PAGE_JPEG_QUALITY,
  PAGE_MAX_HEIGHT,
  PAGE_MAX_WIDTH,
  fmtSize,
  type MangaPage,
} from "./mangaLab";

// Multi-page uploader for a manga/comic chapter: pick many images at once,
// each becomes one page; reorder by drag or ↑/↓; remove; see per-page size.
// Images are resized in-browser exactly like the real pipeline would, and the
// resulting byte size is what feeds the storage estimate — so the memory math
// is measured, not guessed. Nothing is sent to a server in the lab: previews
// use object URLs.
/* eslint-disable @next/next/no-img-element */

let seq = 0;
const nextId = () => `p${Date.now().toString(36)}-${seq++}`;

export function MangaPageUploader({
  pages,
  onChange,
}: {
  pages: MangaPage[];
  onChange: (pages: MangaPage[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<number | null>(null);

  const addFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setBusy(true);
      setSkipped([]);
      const dropped: string[] = [];
      // Natural order (sahifa-1, sahifa-2, … sahifa-10) rather than lexical.
      const list = Array.from(files).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      );
      const added: MangaPage[] = [];
      for (const file of list) {
        if (!file.type.startsWith("image/")) {
          dropped.push(file.name);
          continue;
        }
        const resized = await resizeImageFile(file, {
          maxWidth: PAGE_MAX_WIDTH,
          maxHeight: PAGE_MAX_HEIGHT,
          quality: PAGE_JPEG_QUALITY,
        });
        if (resized.size > MAX_FILE_MB * 1024 * 1024) {
          dropped.push(file.name); // still too heavy even after resize
          continue;
        }
        added.push({ id: nextId(), src: URL.createObjectURL(resized), name: file.name, bytes: resized.size });
      }
      onChange([...pages, ...added]);
      setSkipped(dropped);
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    },
    [pages, onChange]
  );

  function remove(id: string) {
    const victim = pages.find((p) => p.id === id);
    if (victim?.src.startsWith("blob:")) URL.revokeObjectURL(victim.src);
    onChange(pages.filter((p) => p.id !== id));
  }

  function move(i: number, j: number) {
    if (j < 0 || j >= pages.length) return;
    const next = pages.slice();
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item);
    onChange(next);
  }

  function onDrop(to: number) {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from === null || from === to) return;
    move(from, to);
  }

  const total = pages.reduce((s, p) => s + (p.bytes ?? 0), 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex h-11 cursor-pointer items-center gap-2 rounded-[12px] bg-accent px-4 text-[14px] font-bold text-white hover:bg-accent-hover">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          {busy ? "Yuklanmoqda…" : pages.length ? "Yana sahifa qo‘shish" : "Sahifalarni tanlash"}
        </label>
        {pages.length > 0 && (
          <>
            <span className="text-[13.5px] font-semibold text-ink-soft">
              {pages.length} sahifa · {fmtSize(total)}
            </span>
            <button
              type="button"
              onClick={() => {
                pages.forEach((p) => p.src.startsWith("blob:") && URL.revokeObjectURL(p.src));
                onChange([]);
              }}
              className="text-[13px] font-semibold text-muted-2 hover:text-danger"
            >
              Hammasini tozalash
            </button>
          </>
        )}
      </div>

      <p className="mb-4 text-[13px] text-muted-2">
        Bir nechta rasmni birdan tanlang — har biri alohida sahifa bo‘ladi. Tartibni tortib yoki ↑/↓ bilan
        o‘zgartirasiz. Rasmlar brauzerda ~{PAGE_MAX_WIDTH}px gacha kichraytiriladi (xuddi haqiqiy yuklashdagidek).
      </p>

      {skipped.length > 0 && (
        <p className="mb-4 rounded-[10px] bg-danger-bg px-3.5 py-2.5 text-[12.5px] text-danger">
          O‘tkazib yuborildi (rasm emas yoki juda katta): {skipped.join(", ")}
        </p>
      )}

      {pages.length === 0 ? (
        <div className="rounded-[14px] border-2 border-dashed border-primary-300 bg-surface px-6 py-12 text-center text-[14px] text-muted-2">
          Hali sahifa yo‘q. “Sahifalarni tanlash”ni bosing.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {pages.map((p, i) => (
            <div
              key={p.id}
              draggable
              onDragStart={() => (dragFrom.current = i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(i)}
              className="group relative overflow-hidden rounded-[10px] border border-border bg-card"
            >
              <div className="absolute left-1 top-1 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums">
                {i + 1}
              </div>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-black/70 text-[13px] text-white opacity-0 transition group-hover:opacity-100"
                aria-label="O‘chirish"
              >
                ✕
              </button>
              <img src={p.src} alt={`Sahifa ${i + 1}`} className="aspect-2/3 w-full cursor-grab object-cover" draggable={false} />
              <div className="flex items-center justify-between px-1.5 py-1">
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    className="rounded px-1 text-[13px] text-muted-2 hover:bg-surface disabled:opacity-25"
                    aria-label="Chapga"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, i + 1)}
                    disabled={i === pages.length - 1}
                    className="rounded px-1 text-[13px] text-muted-2 hover:bg-surface disabled:opacity-25"
                    aria-label="O‘ngga"
                  >
                    ↓
                  </button>
                </div>
                <span className="truncate pr-0.5 text-[10.5px] text-muted-3">{p.bytes ? fmtSize(p.bytes) : ""}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
