"use client";

import { useRef, useState, useCallback } from "react";
import { resizeImageFile } from "@/lib/image-resize";
import { uploadUserImage, deleteUserImage } from "@/lib/actions/uploads";
import { PAGE_JPEG_QUALITY, PAGE_MAX_HEIGHT, PAGE_MAX_WIDTH, MAX_FILE_MB, fmtSize } from "./mangaLab";
import type { MangaPageData } from "@/types/database";

// Production manga/comic page uploader: pick many images at once, each is
// resized in the browser (like covers) and uploaded to the author's own
// chapter-images folder; the parent gets back an ordered MangaPageData[].
// Reorder by drag or ↑/↓, remove deletes the stored file. Previews use the
// /thumb pipeline so the editor grid stays light.
/* eslint-disable @next/next/no-img-element */

function thumb(url: string): string {
  // /uploads/chapter-images/<id>/<file> -> /thumb/chapter-images/<id>/<file>?w=240
  return url.startsWith("/uploads/") ? `/thumb/${url.slice("/uploads/".length)}?w=240` : url;
}

export function MangaChapterUploader({
  pages,
  onChange,
}: {
  pages: MangaPageData[];
  onChange: (pages: MangaPageData[]) => void;
}) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<number | null>(null);

  const addFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      // Natural order (sahifa-1 … sahifa-10, not lexical).
      const list = Array.from(files).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      );
      setSkipped([]);
      setProgress({ done: 0, total: list.length });
      const dropped: string[] = [];
      const added: MangaPageData[] = [];
      // Sequential: the upload action rate-limits per user, and this keeps the
      // 3-core server from a burst of parallel sharp thumbnailing later.
      for (const file of list) {
        if (!file.type.startsWith("image/")) {
          dropped.push(file.name);
          setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
          continue;
        }
        try {
          const resized = await resizeImageFile(file, {
            maxWidth: PAGE_MAX_WIDTH,
            maxHeight: PAGE_MAX_HEIGHT,
            quality: PAGE_JPEG_QUALITY,
          });
          if (resized.size > MAX_FILE_MB * 1024 * 1024) {
            dropped.push(file.name);
          } else {
            const fd = new FormData();
            fd.set("file", resized, resized.name);
            const res = await uploadUserImage("chapter-images", fd);
            if ("error" in res) {
              dropped.push(file.name);
            } else {
              let w: number | undefined;
              let h: number | undefined;
              try {
                const bmp = await createImageBitmap(resized);
                w = bmp.width;
                h = bmp.height;
                bmp.close();
              } catch {
                /* dimensions are optional */
              }
              added.push({ url: res.url, w, h, bytes: resized.size });
            }
          }
        } catch {
          dropped.push(file.name);
        }
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
      if (added.length > 0) onChange([...pages, ...added]);
      setSkipped(dropped);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    },
    [pages, onChange]
  );

  function remove(url: string) {
    // Best-effort: free the file on the server too.
    void deleteUserImage("chapter-images", url);
    onChange(pages.filter((p) => p.url !== url));
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
  const busy = progress !== null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label
          className={`flex h-11 items-center gap-2 rounded-[12px] bg-accent px-4 text-[14px] font-bold text-white ${
            busy ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-accent-hover"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          {busy ? `Yuklanmoqda… ${progress!.done}/${progress!.total}` : pages.length ? "Yana sahifa qo‘shish" : "Sahifalarni tanlash"}
        </label>
        {pages.length > 0 && (
          <span className="text-[13.5px] font-semibold text-ink-soft">
            {pages.length} sahifa · {fmtSize(total)}
          </span>
        )}
      </div>

      <p className="mb-4 text-[13px] text-muted-2">
        Bir nechta rasmni birdan tanlang — har biri alohida sahifa. Tartibni tortib yoki ↑/↓ bilan o‘zgartirasiz.
        Rasmlar ~{PAGE_MAX_WIDTH}px gacha kichraytirilib yuklanadi.
      </p>

      {skipped.length > 0 && (
        <p className="mb-4 rounded-[10px] bg-danger-bg px-3.5 py-2.5 text-[12.5px] text-danger">
          Yuklanmadi (rasm emas yoki juda katta): {skipped.join(", ")}
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
              key={p.url}
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
                onClick={() => remove(p.url)}
                className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-black/70 text-[13px] text-white opacity-0 transition group-hover:opacity-100"
                aria-label="O‘chirish"
              >
                ✕
              </button>
              <img src={thumb(p.url)} alt={`Sahifa ${i + 1}`} loading="lazy" className="aspect-2/3 w-full cursor-grab object-cover" draggable={false} />
              <div className="flex items-center justify-between px-1.5 py-1">
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    className="rounded px-1 text-[13px] text-muted-2 hover:bg-surface disabled:opacity-25"
                    aria-label="Oldinga"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, i + 1)}
                    disabled={i === pages.length - 1}
                    className="rounded px-1 text-[13px] text-muted-2 hover:bg-surface disabled:opacity-25"
                    aria-label="Keyinga"
                  >
                    ↓
                  </button>
                </div>
                <span className="pr-0.5 text-[10.5px] text-muted-3">{p.bytes ? fmtSize(p.bytes) : ""}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
