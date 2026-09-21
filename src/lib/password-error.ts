import type { Dictionary } from "@/lib/i18n";

// Supabase's actual password rules right now: minimum length (checked
// client-side before submit) and same_password (can't reuse the current
// one). weak_password isn't reachable with today's Dashboard config (no
// character-class or leaked-password checks enabled) but is handled here so
// enabling those later doesn't fall back to a generic, unhelpful message.
export function passwordErrorMessage(code: string | undefined, t: Dictionary, fallback: string): string {
  if (code === "same_password") return t.profile.passwordSamePassword;
  if (code === "weak_password") return t.profile.passwordWeak;
  return fallback;
}
