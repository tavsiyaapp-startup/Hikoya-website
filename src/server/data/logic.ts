import type { ChapterStatus, StoryVisibility } from "@/types/database";

// Pure rules shared by the data-access layer. No database, no I/O — easy to
// test directly and to read next to the SQL that uses them.

// A draft stays a draft regardless of review settings; anything else goes
// through review when the platform requires it (platform_settings.new_story_requires_review).
//
// Returned as ChapterStatus, not the wider StoryStatus: a story can also be
// "unlisted", but this function never produces that value, and its result
// also gets assigned to a new story's first chapter (which has no "unlisted"
// status at all) — see createStory in src/server/data/stories.ts. Typing it
// this way makes that reuse checked instead of merely true by convention.
export function computeStoryStatus(visibility: StoryVisibility, requiresReview: boolean): ChapterStatus {
  if (visibility === "draft") return "draft";
  return requiresReview ? "pending_review" : "published";
}

export function computeChapterStatus(requiresReview: boolean): ChapterStatus {
  return requiresReview ? "pending_review" : "published";
}

// addChapter always appends at the end — see backend_functions.md finding 10
// for why this must run inside a transaction with the story row locked.
export function nextOrderIndex(maxOrderIndex: number | null): number {
  return (maxOrderIndex ?? 0) + 1;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

export function wordCount(html: string): number {
  return stripHtml(html).trim().split(/\s+/).filter(Boolean).length;
}

// Finding 4 in backend_functions.md: tag creation bypassed RLS with no limit.
// An author can introduce a handful of new tags per submission, not an
// unbounded batch, and not absurdly long labels.
export const MAX_NEW_TAGS_PER_STORY = 5;
export const MAX_TAG_LABEL_LENGTH = 24;

export function sanitizeNewTagLabels(labels: string[]): string[] {
  return [...new Set(labels.map((l) => l.trim()).filter(Boolean))]
    .filter((l) => l.length <= MAX_TAG_LABEL_LENGTH)
    .slice(0, MAX_NEW_TAGS_PER_STORY);
}

export type ReportAction = "dismiss" | "hide" | "block";

export const REPORT_REASONS = ["spam", "abuse", "spoiler", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export function isValidReportReason(reason: string): reason is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(reason);
}
