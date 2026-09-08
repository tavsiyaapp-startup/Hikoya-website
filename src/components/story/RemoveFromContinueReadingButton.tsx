"use client";

import { useTransition } from "react";
import { removeFromContinueReading } from "@/lib/actions/reading";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { CloseIcon } from "@/components/ui/icons";

export function RemoveFromContinueReadingButton({ storyId, path }: { storyId: string; path: string }) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(() => removeFromContinueReading(storyId, path));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={t.home.removeFromContinueReading}
      title={t.home.removeFromContinueReading}
      className="absolute right-2 top-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-50"
    >
      <CloseIcon width={12} height={12} />
    </button>
  );
}
