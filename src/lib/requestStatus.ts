// Only "open" reads as active/green — every other status (in_progress,
// fulfilled, closed) is visually neutral. Shared by /board and the admin
// requests table so the two never drift apart.
export function requestStatusTone(status: string): "success" | "neutral" {
  return status === "open" ? "success" : "neutral";
}
