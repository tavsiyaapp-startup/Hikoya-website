"use client";

import { useTransition } from "react";
import { toggleFeaturedStory } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Toggle } from "@/components/ui/Toggle";
import type { StoryTopTier } from "@/types/database";

const TIERS: StoryTopTier[] = ["day", "week", "month"];

export function FeaturedStoryRow({
  storyId,
  title,
  authorName,
  tiers,
}: {
  storyId: string;
  title: string;
  authorName: string | undefined;
  tiers: Set<StoryTopTier>;
}) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();

  const tierLabels: Record<StoryTopTier, string> = {
    day: t.admin.topTierDay,
    week: t.admin.topTierWeek,
    month: t.admin.topTierMonth,
  };

  return (
    <div className="flex items-center gap-4 border-b border-border-soft py-3.5 last:border-0">
      <div className="min-w-0 flex-[1.6]">
        <div className="truncate text-[14.5px] font-bold">{title}</div>
        <div className="truncate text-[12.5px] text-muted-2">{authorName}</div>
      </div>
      {TIERS.map((tier) => (
        <span key={tier} className="flex w-27.5 shrink-0 flex-col items-start gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-3">{tierLabels[tier]}</span>
          <Toggle
            checked={tiers.has(tier)}
            onChange={(next) => !pending && startTransition(() => toggleFeaturedStory(storyId, tier, next))}
            label={tierLabels[tier]}
          />
        </span>
      ))}
    </div>
  );
}
