"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { deleteAnnouncement } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { AnnouncementForm } from "./AnnouncementForm";
import { ImageIcon } from "@/components/ui/icons";
import type { Announcement } from "@/types/database";

export function AnnouncementListItem({ announcement }: { announcement: Announcement }) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  function handleDelete() {
    if (!window.confirm(t.admin.announcementConfirmDelete)) return;
    startTransition(() => deleteAnnouncement(announcement.id));
  }

  if (editing) {
    return (
      <div className="border-b border-border-soft py-3.5 last:border-0">
        <AnnouncementForm announcement={announcement} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3.5 border-b border-border-soft py-3.5 last:border-0">
      <div className="relative flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-linear-to-br from-primary-100 to-pink-bg">
        {announcement.image_url ? (
          <Image src={announcement.image_url} alt="" fill className="object-cover" />
        ) : (
          <ImageIcon width={20} height={20} className="text-primary-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {announcement.text_ru || announcement.text_uz ? (
          <>
            <div className="truncate text-[14px] font-bold">{announcement.text_ru}</div>
            <div className="truncate text-[12.5px] text-muted-2">{announcement.text_uz}</div>
          </>
        ) : (
          <div className="truncate text-[13px] text-muted-2">{t.admin.announcementImageOnly}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="h-8.5 shrink-0 cursor-pointer rounded-[9px] border border-border bg-card px-3.5 text-[12.5px] font-bold text-ink hover:border-primary-300"
      >
        {t.admin.editAction}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={handleDelete}
        className="h-8.5 shrink-0 cursor-pointer rounded-[9px] border border-red-200 dark:border-red-900/60 bg-card px-3.5 text-[12.5px] font-bold text-danger disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t.admin.delete}
      </button>
    </div>
  );
}
