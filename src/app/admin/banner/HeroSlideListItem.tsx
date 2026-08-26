"use client";

import { useTransition } from "react";
import Image from "next/image";
import { deleteHeroSlide } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { HeroSlide } from "@/types/database";

export function HeroSlideListItem({ slide }: { slide: HeroSlide }) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(t.admin.bannerConfirmDelete)) return;
    startTransition(() => deleteHeroSlide(slide.id));
  }

  return (
    <div className="flex items-center gap-3.5 border-b border-border-soft py-3.5 last:border-0">
      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-[10px] bg-primary-200">
        <Image src={slide.image_url} alt="" fill className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-bold">{slide.title_ru}</div>
        <div className="truncate text-[12.5px] text-muted-2">{slide.title_uz}</div>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={handleDelete}
        className="h-8.5 shrink-0 cursor-pointer rounded-[9px] border border-red-200 bg-white px-3.5 text-[12.5px] font-bold text-danger disabled:opacity-50"
      >
        {t.admin.delete}
      </button>
    </div>
  );
}
