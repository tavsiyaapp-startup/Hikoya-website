"use client";

import { useState } from "react";
import { markNotificationRead } from "@/lib/actions/notifications";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { AnnouncementBody } from "./AnnouncementBody";

// One-time popup for a staff announcement (sent from /admin/broadcast).
// It is the same row as the bell notification: closing it — or following its
// link — marks that notification read, so it never pops up again, and one
// already read in the notifications list never pops up at all.
export function AnnouncementPopup({ id, message }: { id: string; message: string }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(true);

  if (!open) return null;

  function close() {
    setOpen(false);
    void markNotificationRead(id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal
        aria-labelledby="announcement-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-110 rounded-[18px] border border-border bg-card p-6 shadow-[0_30px_80px_rgba(30,20,60,0.25)] sm:p-7"
      >
        <h2 id="announcement-title" className="mb-3 text-[13px] font-bold uppercase tracking-wide text-primary-800">
          {t.notifications.announcement}
        </h2>
        <AnnouncementBody message={message} onLinkClick={close} />
        <div className="mt-5 flex justify-end">
          <Button variant="ghost" onClick={close}>
            {t.notifications.announcementClose}
          </Button>
        </div>
      </div>
    </div>
  );
}
