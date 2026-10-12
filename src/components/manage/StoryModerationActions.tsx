"use client";

import { useState, useTransition } from "react";
import { submitStoryForReview } from "@/lib/actions/stories";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import type { StoryStatus } from "@/types/database";

export function StoryModerationActions({
  storyId,
  storySlug,
  status,
}: {
  storyId: string;
  storySlug: string;
  status: StoryStatus;
}) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  if (status !== "draft") return null;

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(false);
          startTransition(async () => {
            if (!(await submitStoryForReview(storyId, storySlug))) setError(true);
          });
        }}
      >
        {pending ? t.common.loading : t.manage.submitForReview}
      </Button>
      {error && <p className="text-[12.5px] font-semibold text-danger">{t.common.error}</p>}
    </div>
  );
}
