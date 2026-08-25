"use client";

import { useTransition } from "react";
import { submitStoryForReview } from "@/lib/actions/stories";
import { approveStory, rejectStory } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import type { StoryStatus } from "@/types/database";

export function StoryModerationActions({
  storyId,
  storySlug,
  status,
  isStaff,
}: {
  storyId: string;
  storySlug: string;
  status: StoryStatus;
  isStaff: boolean;
}) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();

  if (status === "draft") {
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

  if (status === "pending_review" && isStaff) {
    return (
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => startTransition(() => approveStory(storyId, storySlug))}>
          {t.manage.approve}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => startTransition(() => rejectStory(storyId, storySlug))}
        >
          {t.manage.reject}
        </Button>
      </div>
    );
  }

  return null;
}
