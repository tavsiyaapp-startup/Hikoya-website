"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";

// One-time popup announcing the «Obuna» subscription, shown to every
// signed-in user once (guests never see it). Unlike the staff
// AnnouncementPopup it writes nothing to the database: the "already seen"
// flag lives in the browser, keyed by user id so each account that logs in
// here sees it once, including right after registration. Bump the version in
// KEY to show a fresh announcement again later.
const KEY = "hikoya:obuna-announce:v1";

export function SubscriptionAnnounce({ userId }: { userId: string }) {
  const { t } = useLocale();
  // Starts closed so the server and the first client render match (no
  // hydration mismatch); the effect opens it only when it hasn't been seen.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(`${KEY}:${userId}`)) return;
    } catch {
      // storage off — show it this once rather than never.
    }
    setOpen(true);
  }, [userId]);

  if (!open) return null;

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(`${KEY}:${userId}`, "1");
    } catch {
      // storage off — it may show again next visit; acceptable for a notice.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal
        aria-labelledby="obuna-announce-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-110 rounded-[18px] border border-border bg-card p-6 shadow-[0_30px_80px_rgba(30,20,60,0.25)] sm:p-7"
      >
        <h2 id="obuna-announce-title" className="mb-3 text-[19px] font-bold text-ink">
          {t.obunaAnnounce.title}
        </h2>
        <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink-soft">{t.obunaAnnounce.body}</p>
        <div className="mt-5 flex justify-end">
          <Button onClick={close}>{t.obunaAnnounce.gotIt}</Button>
        </div>
      </div>
    </div>
  );
}
