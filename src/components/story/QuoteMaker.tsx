"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { CloseIcon } from "@/components/ui/icons";
import { beginQuote } from "@/lib/actions/paywall";
import type { PaywallOffer } from "@/lib/paywall-offer";
import { SubscribeDialog } from "@/components/paywall/SubscribeDialog";
import { pickCoverColors } from "@/lib/cover-colors";

// Select a sentence in the chapter → an «Iqtibos» button appears under it →
// a sheet shows the quote card (drawn by /api/quote, no AI) in three styles
// and two formats, to share straight to Telegram/Instagram (Web Share with
// a file on phones) or download.

const TEXT_ID = "chapter-text";
const MIN_LEN = 8;
const MAX_LEN = 300;
type Style = "book" | "paper" | "night" | "cover";
type Format = "post" | "story";

function selectedQuote(): { text: string; rect: DOMRect } | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const root = document.getElementById(TEXT_ID);
  const range = sel.getRangeAt(0);
  if (!root || !root.contains(range.commonAncestorContainer)) return null;
  const text = sel.toString().replace(/\s+/g, " ").trim();
  if (text.length < MIN_LEN) return null;
  return { text, rect: range.getBoundingClientRect() };
}

export function QuoteMaker({
  chapterId,
  storyTitle,
  paywallOffer = null,
  signedIn = false,
  nextPath = "/",
  allowCopy = false,
  coverUrl = null,
}: {
  chapterId: string;
  storyTitle: string;
  // Set while the «Obuna» subscription is on: each new card is first cleared
  // by beginQuote (free trials / subscription), which returns a ticket.
  paywallOffer?: PaywallOffer | null;
  signedIn?: boolean;
  nextPath?: string;
  // The story's own author may copy their text; readers share it only as
  // a quote card.
  allowCopy?: boolean;
  // The story's uploaded cover: offers a «Muqova» card in its colours.
  coverUrl?: string | null;
}) {
  const { t } = useLocale();
  const [pick, setPick] = useState<{ text: string; top: number; left: number } | null>(null);
  const [quote, setQuote] = useState<string | null>(null);
  const [style, setStyle] = useState<Style>("book");
  const [format, setFormat] = useState<Format>("story");
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);
  const [trialsLeft, setTrialsLeft] = useState<number | null>(null);
  const [gate, setGate] = useState<"signup" | "subscribe" | null>(null);
  const [checking, setChecking] = useState(false);
  const [copyBlocked, setCopyBlocked] = useState(false);
  // "rrggbb,rrggbb" once read from the cover; "failed" → the server draws
  // the «Kitob rangi» colours instead.
  const [coverColors, setCoverColors] = useState<string | null>(null);

  // The cover is already on the reader's screen elsewhere, so reading its
  // colours here costs the server nothing: a 48×48 canvas, two colours out.
  function pickCover() {
    setStyle("cover");
    if (coverColors || !coverUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas");
        ctx.drawImage(img, 0, 0, 48, 48);
        setCoverColors(pickCoverColors(ctx.getImageData(0, 0, 48, 48).data).join(","));
      } catch {
        setCoverColors("failed");
      }
    };
    img.onerror = () => setCoverColors("failed");
    img.src = coverUrl;
  }

  // No copying out of the chapter text (Ctrl+C, the phone's "Copy", cut,
  // dragging the selection away). Selecting still works — that is how a
  // quote card starts. It only stops casual copying: the text is on the
  // page, so a determined person can still get it.
  useEffect(() => {
    if (allowCopy) return;
    const touchesText = () => {
      const root = document.getElementById(TEXT_ID);
      const sel = window.getSelection();
      if (!root || !sel || sel.rangeCount === 0) return false;
      for (let i = 0; i < sel.rangeCount; i++) if (sel.getRangeAt(i).intersectsNode(root)) return true;
      return false;
    };
    const block = (e: Event) => {
      if (!touchesText()) return;
      e.preventDefault();
      setCopyBlocked(true);
    };
    const blockDrag = (e: DragEvent) => {
      const root = document.getElementById(TEXT_ID);
      if (root && e.target instanceof Node && root.contains(e.target)) e.preventDefault();
    };
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("dragstart", blockDrag);
    return () => {
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("dragstart", blockDrag);
    };
  }, [allowCopy]);

  useEffect(() => {
    if (!copyBlocked) return;
    const id = setTimeout(() => setCopyBlocked(false), 3500);
    return () => clearTimeout(id);
  }, [copyBlocked]);

  // Watch the selection; place the button just under it (above the phone's
  // own copy/select menu, which opens over the selection).
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const q = selectedQuote();
        if (!q) {
          setPick(null);
          return;
        }
        const top = Math.min(window.innerHeight - 64, q.rect.bottom + 12);
        const left = Math.min(window.innerWidth - 90, Math.max(90, q.rect.left + q.rect.width / 2));
        setPick({ text: q.text, top, left });
      });
    };
    document.addEventListener("selectionchange", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, []);

  const waitingForCover = style === "cover" && coverColors === null;
  const src =
    quote && !waitingForCover
      ? `/api/quote?${new URLSearchParams({
          c: chapterId,
          q: quote,
          s: style,
          f: format,
          ...(ticket ? { k: ticket } : {}),
          ...(style === "cover" && coverColors && coverColors !== "failed" ? { p: coverColors } : {}),
        }).toString()}`
      : "";
  // Loading/failed state is derived from which card URL last loaded or
  // failed, so switching style/format shows "loading" until the new one is in.
  const status = failed === src ? "error" : loaded === src ? "ready" : "loading";

  const close = useCallback(() => setQuote(null), []);

  async function fileFromCard(): Promise<File> {
    const res = await fetch(src);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    return new File([blob], `hikoya-iqtibos-${format}.png`, { type: "image/png" });
  }

  function saveFile(f: File) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function share() {
    setBusy(true);
    try {
      const file = await fileFromCard();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: storyTitle, text: `«${quote}» — ${storyTitle} · hikoya.org` });
      } else {
        saveFile(file);
      }
    } catch (err) {
      // The person closed the share sheet — not an error worth showing.
      if ((err as Error)?.name !== "AbortError") setFailed(src);
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    try {
      saveFile(await fileFromCard());
    } catch {
      setFailed(src);
    } finally {
      setBusy(false);
    }
  }

  const tooLong = (pick?.text.length ?? 0) > MAX_LEN;
  const chip = (active: boolean) =>
    clsx(
      "h-9 cursor-pointer rounded-full border px-3.5 text-[13px] font-semibold transition",
      active ? "border-ink bg-ink text-card" : "border-border bg-card text-ink-soft hover:border-primary-200"
    );

  return (
    <>
      {pick && !quote && (
        <button
          type="button"
          // Pressing the button must not clear the selection before the click.
          onPointerDown={(e) => e.preventDefault()}
          onClick={async () => {
            if (tooLong || checking) return;
            const text = pick.text;
            if (paywallOffer) {
              setChecking(true);
              const res = await beginQuote(chapterId, text).catch(() => null);
              setChecking(false);
              if (!res || !res.ok) {
                if (res && res.reason !== "failed") setGate(res.reason);
                return;
              }
              setTicket(res.ticket);
              setTrialsLeft(res.trialsLeft);
            }
            setQuote(text);
            window.getSelection()?.removeAllRanges();
            setPick(null);
          }}
          style={{ top: pick.top, left: pick.left }}
          className={clsx(
            "fixed z-40 flex h-10 -translate-x-1/2 items-center gap-2 rounded-full px-4 text-[13.5px] font-bold shadow-[0_14px_30px_-12px_rgba(45,31,85,0.6)] transition",
            tooLong ? "cursor-default bg-card text-muted-2 ring-1 ring-border" : "cursor-pointer bg-ink text-card"
          )}
        >
          {tooLong ? t.quote.tooLong : <>“ {t.quote.button}</>}
        </button>
      )}

      {quote && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-label={t.quote.title}>
          <button type="button" aria-label={t.common.close} onClick={close} className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[2px]" />
          <div className="relative flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[26px] bg-card sm:rounded-[26px]">
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <div>
                <h2 className="text-[19px] font-bold">{t.quote.title}</h2>
                {trialsLeft !== null && (
                  <p className="text-[12px] font-semibold text-primary-800">{t.paywall.quoteTrialsLeft.replace("{n}", String(trialsLeft))}</p>
                )}
              </div>
              <button type="button" onClick={close} aria-label={t.common.close} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full hover:bg-surface">
                <CloseIcon />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-surface px-5 py-4">
              <div
                className={clsx(
                  "relative h-[52dvh] max-w-full overflow-hidden rounded-[14px] shadow-[0_18px_40px_-18px_rgba(45,31,85,0.5)]",
                  format === "story" ? "aspect-[9/16]" : "aspect-[4/5]"
                )}
              >
                {status !== "ready" && (
                  <div className="skeleton absolute inset-0 flex items-center justify-center p-4 text-center text-[13px] font-semibold text-muted-2">
                    {status === "error" ? t.quote.failed : t.quote.loading}
                  </div>
                )}
                {src && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG from our own API, shown as is */}
                    <img
                      key={src}
                      src={src}
                      alt={quote}
                      onLoad={() => setLoaded(src)}
                      onError={() => setFailed(src)}
                      className={clsx("h-full w-full object-contain transition-opacity", status === "ready" ? "opacity-100" : "opacity-0")}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 px-5 pt-4" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
              <div className="flex flex-wrap gap-2">
                {(["book", "paper", "night"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setStyle(s)} className={chip(style === s)}>
                    {s === "book" ? t.quote.styleBook : s === "paper" ? t.quote.stylePaper : t.quote.styleNight}
                  </button>
                ))}
                {coverUrl && (
                  <button type="button" onClick={pickCover} className={chip(style === "cover")}>
                    {t.quote.styleCover}
                  </button>
                )}
                <span className="mx-1 w-px self-stretch bg-border" />
                {(["story", "post"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setFormat(f)} className={chip(format === f)}>
                    {f === "story" ? t.quote.formatStory : t.quote.formatPost}
                  </button>
                ))}
              </div>
              <div className="flex gap-2.5">
                <Button className="flex-1 justify-center" disabled={busy || status !== "ready"} onClick={share}>
                  {t.quote.share}
                </Button>
                <Button variant="ghost" className="justify-center" disabled={busy || status !== "ready"} onClick={download}>
                  {t.quote.download}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {copyBlocked && (
        <div
          role="status"
          className="fixed inset-x-4 top-20 z-50 mx-auto max-w-sm rounded-[16px] bg-ink px-4 py-3 text-center text-[13.5px] font-semibold leading-snug text-card shadow-[0_18px_40px_-16px_rgba(20,16,31,0.6)] sm:top-24"
        >
          {t.quote.copyBlocked}
        </div>
      )}

      {gate && paywallOffer && (
        <SubscribeDialog
          offer={paywallOffer}
          signedIn={signedIn}
          nextPath={nextPath}
          intro={gate === "subscribe" ? t.paywall.quoteSubscribe : t.paywall.quoteSignup}
          onClose={() => setGate(null)}
        />
      )}
    </>
  );
}
