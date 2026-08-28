"use client";

import { useState, useTransition } from "react";
import { restoreStory, permanentlyDeleteStory } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";

export function TrashActions({ storyId, storySlug }: { storyId: string; storySlug: string }) {
  const { t } = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (confirming) {
    return (
      <div className="flex flex-col gap-2.5">
        <p className="text-[13px] text-danger">{t.admin.permanentDeleteWarning}</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() => startTransition(() => permanentlyDeleteStory(storyId))}
          >
            {pending ? t.common.loading : t.admin.confirmPermanentDelete}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
            {t.common.cancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => startTransition(() => restoreStory(storyId, storySlug))}>
        {t.admin.restoreStory}
      </Button>
      <Button type="button" variant="danger" size="sm" disabled={pending} onClick={() => setConfirming(true)}>
        {t.admin.permanentlyDelete}
      </Button>
    </div>
  );
}
