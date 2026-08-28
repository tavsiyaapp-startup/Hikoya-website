"use client";

import { useState, useTransition } from "react";
import { deleteStory } from "@/lib/actions/stories";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";

export function DeleteStoryButton({
  storyId,
  storySlug,
  storyTitle,
}: {
  storyId: string;
  storySlug: string;
  storyTitle: string;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-6 rounded-3xl border border-red-200 dark:border-red-900/60 bg-danger-bg p-4.5 sm:p-6.5">
      <h3 className="mb-1 text-[15px] font-extrabold text-danger">{t.manage.dangerZoneTitle}</h3>
      <p className="mb-4 text-[13.5px] leading-relaxed text-ink-soft">{t.manage.deleteStoryWarning}</p>
      <Button variant="danger" onClick={() => setOpen(true)}>
        {t.manage.deleteStory}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            role="alertdialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-105 rounded-3xl border border-border bg-card p-6 shadow-[0_30px_80px_rgba(30,20,60,0.25)]"
          >
            <h3 className="mb-2 text-[18px] font-extrabold tracking-tight">
              {t.manage.deleteStoryModalTitle.replace("{title}", storyTitle)}
            </h3>
            <p className="mb-5 text-[14px] leading-relaxed text-ink-soft">{t.manage.deleteStoryModalBody}</p>
            <div className="flex gap-3">
              <Button type="button" variant="ghost" className="flex-1" disabled={pending} onClick={() => setOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                disabled={pending}
                onClick={() => startTransition(() => deleteStory(storyId, storySlug))}
              >
                {pending ? t.common.loading : t.manage.deleteStoryConfirmButton}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
