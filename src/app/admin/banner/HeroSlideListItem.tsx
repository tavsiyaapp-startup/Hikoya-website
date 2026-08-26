"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { deleteHeroSlide } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { HeroSlideForm } from "./HeroSlideForm";
import type { HeroSlide } from "@/types/database";

export function HeroSlideListItem({ slide, canDelete }: { slide: HeroSlide; canDelete: boolean }) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  function handleDelete() {
    if (!window.confirm(t.admin.bannerConfirmDelete)) return;
    startTransition(() => deleteHeroSlide(slide.id));
  }

  if (editing) {
    return (
      <div className="border-b border-border-soft py-3.5 last:border-0">
        <HeroSlideForm slide={slide} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3.5 border-b border-border-soft py-3.5 last:border-0">
      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-[10px] bg-primary-200">
        <Image src={slide.image_url} alt="" fill className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        {slide.title_ru || slide.title_uz ? (
          <>
            <div className="truncate text-[14px] font-bold">{slide.title_ru}</div>
            <div className="truncate text-[12.5px] text-muted-2">{slide.title_uz}</div>
          </>
        ) : (
          <div className="truncate text-[13px] text-muted-2">{t.admin.bannerImageOnly}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="h-8.5 shrink-0 cursor-pointer rounded-[9px] border border-border bg-white px-3.5 text-[12.5px] font-bold text-ink hover:border-primary-300"
      >
        {t.admin.editAction}
      </button>
      <button
        type="button"
        disabled={pending || !canDelete}
        onClick={handleDelete}
        title={!canDelete ? t.admin.bannerCannotDeleteLast : undefined}
        className="h-8.5 shrink-0 cursor-pointer rounded-[9px] border border-red-200 bg-white px-3.5 text-[12.5px] font-bold text-danger disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t.admin.delete}
      </button>
    </div>
  );
}
