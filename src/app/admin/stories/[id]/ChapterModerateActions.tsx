"use client";

import { useState, useTransition } from "react";
import { approveChapter, rejectChapter } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

export function ChapterModerateActions({
  chapterId,
  storyId,
  storySlug,
}: {
  chapterId: string;
  storyId: string;
  storySlug: string;
}) {
  const { t } = useLocale();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  if (rejecting) {
    return (
      <div className="flex flex-col gap-2.5">
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t.admin.rejectReasonPlaceholder}
          rows={3}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="danger"
            disabled={pending || !reason.trim()}
            onClick={() => startTransition(() => rejectChapter(chapterId, storyId, storySlug, reason.trim()))}
          >
            {pending ? t.common.loading : t.admin.confirmReject}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setRejecting(false)}>
            {t.common.cancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => approveChapter(chapterId, storyId, storySlug))}
      >
        {t.manage.approve}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setRejecting(true)}>
        {t.manage.reject}
      </Button>
    </div>
  );
}
