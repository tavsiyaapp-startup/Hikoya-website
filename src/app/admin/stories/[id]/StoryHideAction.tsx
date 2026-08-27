"use client";

import { useState, useTransition } from "react";
import { hideStory } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

export function StoryHideAction({ storyId, storySlug }: { storyId: string; storySlug: string }) {
  const { t } = useLocale();
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  if (!hiding) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setHiding(true)}>
        {t.admin.hideStory}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t.admin.hideReasonPlaceholder}
        rows={3}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="danger"
          disabled={pending || !reason.trim()}
          onClick={() => startTransition(() => hideStory(storyId, storySlug, reason.trim()))}
        >
          {pending ? t.common.loading : t.admin.confirmHide}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setHiding(false)}>
          {t.common.cancel}
        </Button>
      </div>
    </div>
  );
}
