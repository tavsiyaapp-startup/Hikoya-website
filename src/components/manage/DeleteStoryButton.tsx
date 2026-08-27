"use client";

import { useTransition } from "react";
import { deleteStory } from "@/lib/actions/stories";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";

export function DeleteStoryButton({ storyId, storySlug }: { storyId: string; storySlug: string }) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(t.manage.confirmDeleteStory)) return;
    startTransition(() => deleteStory(storyId, storySlug));
  }

  return (
    <div className="mt-6 rounded-3xl border border-red-200 dark:border-red-900/60 bg-danger-bg p-4.5 sm:p-6.5">
      <h3 className="mb-1 text-[15px] font-extrabold text-danger">{t.manage.dangerZoneTitle}</h3>
      <p className="mb-4 text-[13.5px] leading-relaxed text-ink-soft">{t.manage.deleteStoryWarning}</p>
      <Button variant="danger" disabled={pending} onClick={handleDelete}>
        {pending ? t.common.loading : t.manage.deleteStory}
      </Button>
    </div>
  );
}
