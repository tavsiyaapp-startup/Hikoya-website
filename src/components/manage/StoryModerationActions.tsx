"use client";

import { useTransition } from "react";
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

  if (status !== "draft") return null;

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => submitStoryForReview(storyId, storySlug))}
    >
      {pending ? t.common.loading : t.manage.submitForReview}
    </Button>
  );
}
