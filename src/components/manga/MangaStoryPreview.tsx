"use client";

import { useState } from "react";
import type { MangaPage } from "./mangaLab";

// A self-contained mock of how a manga/comic *work page* and its *comments*
// would look — so the layout can be approved before the real DB-backed
// story page (app/(site)/story/[slug]/page.tsx) is adapted. Uses the uploaded
// pages (if any) for the cover + chapter thumbnails, and hardcoded synthetic
// chapters/comments. Mobile-first; mirrors the site's tokens and the real
// CommentItem styling.
/* eslint-disable @next/next/no-img-element */

type Tab = "chapters" | "comments";

type Chapter = {
  n: number;
  title: string;
  count: number;
  comments: number;
  isNew?: boolean;
  read?: boolean; // finished — shows a ✓
  lastPage?: number; // in progress — "continue from here" drops you on this page
};

export function MangaStoryPreview({ pages, onRead }: { pages: MangaPage[]; onRead: () => void }) {
  const [tab, setTab] = useState<Tab>("chapters");

  const cover = pages[0]?.src ?? null;
  const firstCount = pages.length || 24;

  const chapters: Chapter[] = [
    { n: 1, title: "1-bob — Boshlanishi", count: firstCount, comments: 12, read: true },
    { n: 2, title: "2-bob — Uchrashuv", count: 20, comments: 7, lastPage: 14 },
    { n: 3, title: "3-bob — Sir ochiladi", count: 28, comments: 23, isNew: true },
  ];
  const totalPages = chapters.reduce((s, c) => s + c.count, 0);
  // Where "continue reading" would resume — same idea as the text reader, but
  // for manga it remembers the page inside the chapter too.
  const resume = chapters.find((c) => c.lastPage);

  return (
    <section className="rounded-[16px] border border-border bg-card p-4 sm:p-6.5">
      <h2 className="mb-1 text-[19px] font-extrabold">Asar sahifasi (manga) — ko‘rinishi</h2>
      <p className="mb-5 text-[13.5px] text-muted">
        Haqiqiy sahifa shunga o‘xshaydi: muqova, ma’lumot, boblar (sahifalar soni bilan) va fikrlar. Baho/like/
        xatcho‘p/fikrlar — hammasi hozirgidek ishlaydi.
      </p>

      {/* The mock page itself, boxed like a mini preview frame */}
      <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
        <div className="flex flex-col gap-5 p-4 sm:p-5 lg:flex-row lg:gap-7">
          {/* cover column */}
          <div className="w-full lg:w-56 lg:shrink-0">
            <div className="relative mx-auto aspect-[3/4] w-full max-w-[200px] overflow-hidden rounded-[12px] bg-primary-200 shadow-[0_14px_32px_rgba(60,40,120,0.18)] lg:max-w-none">
              {cover ? (
                <img src={cover} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-primary-300 to-pink-300 text-[13px] font-bold text-white/90">
                  Muqova
                </div>
              )}
              <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white">
                MANGA
              </span>
            </div>
            <button
              type="button"
              onClick={onRead}
              className="mt-3 min-h-12 w-full rounded-[12px] bg-accent px-3 py-2 text-white hover:bg-accent-hover"
            >
              <span className="block text-[15px] font-bold">{resume ? "Davom ettirish" : "O‘qishni boshlash"}</span>
              {resume && (
                <span className="block text-[12px] font-medium text-white/80">
                  {resume.n}-bob · {resume.lastPage}/{resume.count}-sahifa
                </span>
              )}
            </button>
            <div className="mt-2 flex gap-2">
              <button type="button" className="h-10 flex-1 rounded-[11px] border border-border bg-card text-[13px] font-semibold text-ink-soft">
                ♡ Like
              </button>
              <button type="button" className="h-10 flex-1 rounded-[11px] border border-border bg-card text-[13px] font-semibold text-ink-soft">
                🔖 Saqlash
              </button>
            </div>
          </div>

          {/* content column */}
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <MiniBadge tone="pink">Fantastika</MiniBadge>
              <MiniBadge tone="pink">Sarguzasht</MiniBadge>
              <MiniBadge tone="neutral">16+</MiniBadge>
              <MiniBadge tone="primary">Davom etmoqda</MiniBadge>
            </div>
            <h3 className="mb-3 text-[22px] font-extrabold leading-tight tracking-tight sm:text-[26px]">Namuna manga</h3>

            <div className="mb-4 flex flex-wrap gap-5 rounded-[14px] border border-border/80 bg-card/80 px-4 py-3.5 sm:gap-9">
              {[
                ["Ko‘rishlar", "1.2k"],
                ["Like", "340"],
                ["Fikrlar", "42"],
                ["Sahifalar", String(totalPages)],
              ].map(([label, val]) => (
                <div key={label}>
                  <div className="font-display text-[20px] font-bold tabular-nums leading-none">{val}</div>
                  <div className="mt-1 text-[12px] text-muted-2">{label}</div>
                </div>
              ))}
            </div>

            <p className="mb-5 border-l-2 border-primary-300 pl-4 font-display text-[15px] leading-relaxed text-ink-soft">
              Yosh rassom sirli daftarni topib oladi — undagi har bir sahifa jonlanadi. Namuna tavsif matni.
            </p>

            {/* tabs: chapters / comments */}
            <div className="mb-3.5 flex gap-2">
              {(
                [
                  ["chapters", "Boblar"],
                  ["comments", "Fikrlar"],
                ] as [Tab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`h-9 rounded-[10px] px-3.5 text-[13.5px] font-bold transition ${
                    tab === key ? "bg-accent text-white" : "bg-card text-ink-soft hover:bg-primary-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "chapters" ? (
              <ChapterList chapters={chapters} onRead={onRead} />
            ) : (
              <CommentsMock />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ChapterList({ chapters, onRead }: { chapters: Chapter[]; onRead: () => void }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-card">
      {chapters.map((ch, i) => (
        <button
          key={ch.n}
          type="button"
          onClick={onRead}
          className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-primary-50/60 ${
            i < chapters.length - 1 ? "border-b border-border-soft" : ""
          }`}
        >
          {/* lightweight number tile — no per-chapter images, so the chapter
              list costs the server nothing extra to render. */}
          <span className="flex h-11 w-9 shrink-0 items-center justify-center rounded-[7px] bg-primary-100 font-display text-[17px] font-bold tabular-nums text-primary-700">
            {String(ch.n).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`truncate font-display text-[15px] font-semibold ${ch.read ? "text-muted-2" : ""}`}>{ch.title}</span>
              {ch.isNew && <MiniBadge tone="primary">Yangi</MiniBadge>}
            </div>
            <div className="mt-0.5 text-[12px] text-muted-3">
              {ch.count} sahifa · {ch.comments} fikr
            </div>
          </div>
          {ch.read ? (
            <span
              title="O‘qilgan"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-[11px] font-bold text-success"
            >
              ✓
            </span>
          ) : ch.lastPage ? (
            <span className="shrink-0 rounded-md bg-primary-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-primary-700">
              {ch.lastPage}/{ch.count}
            </span>
          ) : (
            <span className="shrink-0 text-[18px] text-muted-3">›</span>
          )}
        </button>
      ))}
    </div>
  );
}

function CommentsMock() {
  const comments = [
    {
      name: "Dilnoza",
      date: "2 kun oldin",
      text: "Rasmlari zo‘r chiqibdi! Keyingi bobni sabrsizlik bilan kutyapman 🔥",
      likes: 14,
      reply: { name: "Muallif", date: "1 kun oldin", text: "Rahmat! Tez orada chiqadi 😊", likes: 3 },
    },
    {
      name: "Sardor",
      date: "4 kun oldin",
      text: "Vebtun rejimida telefonda o‘qish juda qulay bo‘libdi.",
      likes: 6,
      reply: null as null | { name: string; date: string; text: string; likes: number },
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      {/* input */}
      <div className="flex gap-2.5 rounded-[12px] border border-border bg-card p-3">
        <InitialAvatar name="Men" />
        <div className="flex-1">
          <div className="min-h-9 rounded-[10px] border border-border bg-surface px-3 py-2 text-[13.5px] text-muted-3">
            Fikr yozing…
          </div>
          <div className="mt-2 flex justify-end">
            <span className="rounded-[9px] bg-accent px-3.5 py-1.5 text-[12.5px] font-bold text-white">Yuborish</span>
          </div>
        </div>
      </div>

      {comments.map((c) => (
        <div key={c.name}>
          <div className="flex gap-3 rounded-[12px] border border-border bg-card p-3.5">
            <InitialAvatar name={c.name} />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2.5">
                <span className="text-[13.5px] font-bold">{c.name}</span>
                <span className="text-[12px] text-muted-3">{c.date}</span>
              </div>
              <p className="mb-2 text-[14px] leading-relaxed text-ink-soft">{c.text}</p>
              <div className="flex items-center gap-4 text-[12.5px] font-bold text-muted-2">
                <span className="flex items-center gap-1">♡ {c.likes}</span>
                <span>Javob</span>
              </div>
            </div>
          </div>
          {c.reply && (
            <div className="ml-8 mt-2 flex gap-3 rounded-[12px] border border-border bg-card p-3.5">
              <InitialAvatar name={c.reply.name} />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2.5">
                  <span className="text-[13.5px] font-bold">{c.reply.name}</span>
                  <span className="text-[12px] text-muted-3">{c.reply.date}</span>
                </div>
                <p className="mb-2 text-[14px] leading-relaxed text-ink-soft">{c.reply.text}</p>
                <div className="flex items-center gap-4 text-[12.5px] font-bold text-muted-2">
                  <span className="flex items-center gap-1">♡ {c.reply.likes}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function InitialAvatar({ name }: { name: string }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-200 text-[13px] font-bold text-primary-800">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function MiniBadge({ children, tone }: { children: React.ReactNode; tone: "pink" | "primary" | "neutral" }) {
  const cls =
    tone === "pink"
      ? "bg-pink-bg text-pink-700"
      : tone === "primary"
        ? "bg-primary-100 text-primary-800"
        : "bg-surface text-ink-soft";
  return <span className={`rounded-md px-2 py-0.5 text-[11.5px] font-bold ${cls}`}>{children}</span>;
}
