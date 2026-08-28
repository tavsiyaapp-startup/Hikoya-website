import type { Dictionary } from "@/lib/i18n";
import type { StoryProgressStatus } from "@/types/database";

// Shared by StoryCard (every grid of stories) and the story detail page, so
// the two never drift apart.
export function storyProgressTone(status: StoryProgressStatus): "success" | "primary" | "danger" {
  if (status === "finished") return "primary";
  if (status === "dropped") return "danger";
  return "success";
}

export function storyProgressLabel(t: Dictionary, status: StoryProgressStatus): string {
  if (status === "finished") return t.common.finished;
  if (status === "dropped") return t.common.dropped;
  return t.common.ongoing;
}
