import type { Dictionary } from "@/lib/i18n";

// Only "open" reads as active/green — every other status (in_progress,
// fulfilled, closed) is visually neutral. Shared by /board, the author
// profile's "my requests" tab, and the admin requests table so the three
// never drift apart.
export function requestStatusTone(status: string): "success" | "neutral" {
  return status === "open" ? "success" : "neutral";
}

export function requestStatusLabel(t: Dictionary, status: string): string {
  const labels: Record<string, string> = {
    open: t.board.statusOpen,
    in_progress: t.board.statusInProgress,
    fulfilled: t.board.statusFulfilled,
    closed: t.board.statusClosed,
  };
  return labels[status] ?? status;
}
