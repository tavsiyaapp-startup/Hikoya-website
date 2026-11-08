"use client";

import { useMemo, useState } from "react";
import { MangaPageUploader } from "@/components/manga/MangaPageUploader";
import { MangaReader } from "@/components/manga/MangaReader";
import { MangaStoryPreview } from "@/components/manga/MangaStoryPreview";
import {
  DEFAULT_PAGE_BYTES,
  PER_USER_QUOTA_MB,
  fmtSize,
  makeSamplePages,
  projectStorage,
  type MangaKind,
  type MangaPage,
} from "@/components/manga/mangaLab";

// The prototype screen. Flow mirrors what the real create wizard would become:
//   1) pick a work type (text — unchanged — vs manga/comic)
//   2) for manga: upload chapter pages (each image = one page)
//   3) open the manga reader to feel the result
//   4) live storage estimate for the server
export function MangaLab() {
  const [kind, setKind] = useState<MangaKind>("manga");
  const [pages, setPages] = useState<MangaPage[]>([]);
  const [reader, setReader] = useState<MangaPage[] | null>(null);

  // Average page size: measured from real uploads when present, else the
  // documented assumption so the estimate is never empty.
  const avg = useMemo(() => {
    const measured = pages.filter((p) => p.bytes);
    if (measured.length === 0) return DEFAULT_PAGE_BYTES;
    return measured.reduce((s, p) => s + (p.bytes ?? 0), 0) / measured.length;
  }, [pages]);

  const proj = useMemo(() => projectStorage(avg), [avg]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {reader && (
        <MangaReader pages={reader} title="Manga — test o‘qish" onClose={() => setReader(null)} />
      )}

      <div className="mb-6 rounded-[12px] border border-amber-300/60 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        <b>Lokal prototip (/manga-lab).</b> Faqat <code>next dev</code>da ko‘rinadi, bazaga hech narsa yozmaydi,
        saytga chiqmagan. Bu yerda manga/komiks qo‘shish va o‘qish qanday bo‘lishini sinab ko‘ramiz.
      </div>

      <h1 className="mb-1.5 text-[26px] font-extrabold tracking-tight">Asar yaratish — tur tanlash</h1>
      <p className="mb-6 text-[14.5px] text-muted">Asar matnmi yoki manga/komiksmi — shunga qarab muharrir va o‘qish rejimi o‘zgaradi.</p>

      {/* Step 1 — type picker */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <TypeCard
          active={kind === "text"}
          onClick={() => setKind("text")}
          title="Matn (hikoya / kitob)"
          desc="Odatdagi matnli muharrir — boblar matn sifatida yoziladi yoki .docx’dan import qilinadi. Hozirgidek."
          emoji="📖"
        />
        <TypeCard
          active={kind === "manga"}
          onClick={() => setKind("manga")}
          title="Komiks / Manga"
          desc="Boblar sahifa-rasmlardan iborat. O‘qish rejimi manga/komiks uchun moslanadi (vebtun yoki sahifalab)."
          emoji="🖼️"
        />
      </div>

      {kind === "text" ? (
        <div className="rounded-[14px] border border-border bg-card px-6 py-10 text-center text-[14px] text-muted-2">
          Matnli asar uchun hammasi hozirgidek qoladi — bu yerda o‘zgartiriladigan narsa yo‘q.
        </div>
      ) : (
        <>
          {/* Step 2 — upload pages */}
          <section className="mb-8 rounded-[16px] border border-border bg-card p-5 sm:p-6.5">
            <h2 className="mb-1 text-[19px] font-extrabold">1-bob · sahifalarni yuklash</h2>
            <p className="mb-5 text-[13.5px] text-muted">Har bir rasm — bitta sahifa. Nechta bo‘lsa shuncha tanlang.</p>
            <MangaPageUploader pages={pages} onChange={setPages} />
          </section>

          {/* Step 3 — read */}
          <section className="mb-8 flex flex-wrap items-center gap-3 rounded-[16px] border border-border bg-card p-5 sm:p-6.5">
            <div className="min-w-0 flex-1">
              <h2 className="mb-1 text-[19px] font-extrabold">O‘qib ko‘rish</h2>
              <p className="text-[13.5px] text-muted">
                {pages.length > 0
                  ? `Yuklangan ${pages.length} sahifani manga-chitalkada oching.`
                  : "Hali sahifa yuklamadingiz — namuna sahifalar bilan o‘qish rejimini sinab ko‘rishingiz mumkin."}
              </p>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setReader(makeSamplePages(8))}
                className="h-11 rounded-[12px] border border-border bg-surface px-4 text-[14px] font-bold text-ink-soft hover:bg-primary-50"
              >
                Namuna bilan
              </button>
              <button
                type="button"
                disabled={pages.length === 0}
                onClick={() => setReader(pages)}
                className="h-11 rounded-[12px] bg-accent px-5 text-[14px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
              >
                Mangani o‘qish
              </button>
            </div>
          </section>

          {/* Step 4 — how the manga work page + comments will look */}
          <div className="mb-8">
            <MangaStoryPreview pages={pages} onRead={() => setReader(pages.length ? pages : makeSamplePages(8))} />
          </div>

          {/* Step 5 — storage estimate */}
          <StoragePanel pages={pages} avg={avg} proj={proj} />
        </>
      )}
    </div>
  );
}

function TypeCard({
  active,
  onClick,
  title,
  desc,
  emoji,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  emoji: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3.5 rounded-[14px] border p-4.5 text-left transition ${
        active ? "border-primary-500 bg-primary-50 ring-1 ring-primary-300" : "border-border bg-card hover:border-primary-300"
      }`}
    >
      <span className="text-[30px] leading-none">{emoji}</span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[15.5px] font-extrabold">{title}</span>
        <span className="text-[13px] leading-snug text-muted">{desc}</span>
      </span>
      <span
        className={`ml-auto mt-0.5 h-4.5 w-4.5 shrink-0 rounded-full border-2 ${
          active ? "border-accent bg-accent" : "border-border"
        }`}
      />
    </button>
  );
}

function StoragePanel({
  pages,
  avg,
  proj,
}: {
  pages: MangaPage[];
  avg: number;
  proj: ReturnType<typeof projectStorage>;
}) {
  const measured = pages.some((p) => p.bytes) && pages.length > 0;
  const rows: [string, number][] = [
    ["Bitta sahifa (o‘rtacha)", proj.chapter(1)],
    ["Bob · 20 sahifa", proj.chapter(20)],
    ["Bob · 40 sahifa", proj.chapter(40)],
    ["Asar · 100 bob × 20 sahifa", proj.chapter(2000)],
  ];
  return (
    <section className="rounded-[16px] border border-border bg-card p-5 sm:p-6.5">
      <h2 className="mb-1 text-[19px] font-extrabold">Server xotirasi — hisob-kitob</h2>
      <p className="mb-5 text-[13.5px] text-muted">
        O‘rtacha sahifa:{" "}
        <b>{fmtSize(avg)}</b>{" "}
        {measured ? "(yuklagan rasmlaringizdan o‘lchangan)" : "(taxminiy — hali rasm yuklanmadi)"}. Diskda har
        sahifaga o‘qish uchun WebP-nusxa ham qo‘shiladi (~×1.3).
      </p>
      <div className="overflow-hidden rounded-[12px] border border-border">
        {rows.map(([label, bytes], i) => (
          <div
            key={label}
            className={`flex items-center justify-between px-4 py-2.5 text-[13.5px] ${i % 2 ? "bg-surface" : "bg-card"}`}
          >
            <span className="text-ink-soft">{label}</span>
            <span className="text-right font-semibold tabular-nums">
              {fmtSize(bytes)}
              <span className="ml-2 text-muted-3">+WebP ≈ {fmtSize(proj.withThumbs(bytes))}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-start gap-2.5 rounded-[12px] bg-primary-50 px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
        <span>
          Hozirgi bitta foydalanuvchi limiti <b>{PER_USER_QUOTA_MB} MB</b> — bu ≈{" "}
          <b>{proj.pagesPerUserQuota.toLocaleString()} sahifa</b> (WebP bilan). Manga uchun bu kam:
          taxminan {Math.max(1, Math.floor(proj.pagesPerUserQuota / 20))} ta 20-sahifali bob. Haqiqiy
          ishga tushirishda manga-mualliflarga alohida, kattaroq limit kerak bo‘ladi.
        </span>
      </div>
    </section>
  );
}
