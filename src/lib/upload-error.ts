import type { Dictionary } from "@/lib/i18n";

// Maps an uploadUserImage / setStoryCoverAdmin error code to a specific,
// localized message instead of one vague "couldn't upload" line — so a user
// (and we) can tell WHY an upload failed: wrong format, storage full, too many
// tries, or an expired session. Anything else (network drop, server error)
// falls back to the generic message.
export function coverErrorText(t: Dictionary, code?: string): string {
  switch (code) {
    case "invalid_file":
      return t.create.coverErrorFormat;
    case "quota_exceeded":
      return t.create.coverErrorQuota;
    case "rate_limited":
      return t.create.coverErrorRate;
    case "unauthorized":
      return t.create.coverErrorAuth;
    default:
      return t.create.coverError;
  }
}
