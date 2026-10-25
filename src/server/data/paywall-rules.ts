// «Obuna» (paid subscription, test mode) — the rules, as pure functions so
// they can be tested without a database (paywall-rules.test.ts). Database
// work is in paywall.ts; settings come from paywall_settings
// (D:/QIZLAB/backups/paywall.sql), edited in /admin/subscriptions.
//
// Readers: the first N chapters of every story are free (N per story can be
// overridden by an admin), the rest need an active subscription.
// Authors: publishing a chapter needs a subscription too, except a new
// author's first M chapters. An author who had published anything before the
// subscription started gets no free chapters.
// Owners read their own chapters, staff read and publish everything.

export interface PaywallConfig {
  enabled: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  readerFreeChapters: number;
  authorFreeChapters: number;
}

// On, and inside the test window (either end may be open).
export function isPaywallLive(cfg: PaywallConfig | null, now: Date): boolean {
  if (!cfg?.enabled) return false;
  if (cfg.startsAt && now < cfg.startsAt) return false;
  if (cfg.endsAt && now >= cfg.endsAt) return false;
  return true;
}

// Switched on with a start date still ahead: the site shows a notice.
export function isPaywallAnnounced(cfg: PaywallConfig | null, now: Date): boolean {
  return Boolean(cfg?.enabled && cfg.startsAt && now < cfg.startsAt && (!cfg.endsAt || cfg.endsAt > cfg.startsAt));
}

export function isSubscriptionActive(expiresAt: Date | null | undefined, now: Date): boolean {
  return Boolean(expiresAt && expiresAt > now);
}

// A new grant adds to what is left, so paying early never loses days.
export function extendExpiry(current: Date | null | undefined, now: Date, days: number): Date {
  const base = current && current > now ? current : now;
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

export type ChapterAccess = "open" | "signup" | "subscribe";

export function chapterAccess(input: {
  ownerOrStaff: boolean;
  signedIn: boolean;
  orderIndex: number;
  // chapters.is_free (a story's first chapter) and the guest limit from
  // platform_settings — the older "sign up to read on" rule, kept as is.
  isFreeChapter: boolean;
  guestFreeChapters: number;
  live: boolean;
  freeChapters: number;
  subscribed: boolean;
}): ChapterAccess {
  if (input.ownerOrStaff) return "open";
  const guestCanRead = input.isFreeChapter || input.orderIndex <= input.guestFreeChapters;
  if (input.live && input.orderIndex > input.freeChapters) {
    return input.subscribed ? "open" : "subscribe";
  }
  if (input.signedIn || guestCanRead) return "open";
  return "signup";
}

export interface PublishGate {
  allowed: boolean;
  // Free chapters a new author still has (null when no limit applies).
  freeLeft: number | null;
}

export function authorPublishGate(input: {
  live: boolean;
  staff: boolean;
  subscribed: boolean;
  publishedBeforeStart: boolean;
  publishedCount: number;
  authorFreeChapters: number;
}): PublishGate {
  if (!input.live || input.staff || input.subscribed) return { allowed: true, freeLeft: null };
  if (input.publishedBeforeStart) return { allowed: false, freeLeft: 0 };
  const freeLeft = Math.max(0, input.authorFreeChapters - input.publishedCount);
  return { allowed: freeLeft > 0, freeLeft };
}

export type QuoteAccess = "open" | "signup" | "subscribe";

// Quote cards: free while the subscription is off; when it is on, a signed-in
// non-subscriber gets a few trial cards, then needs a subscription.
export function quoteAccess(input: {
  live: boolean;
  signedIn: boolean;
  staff: boolean;
  subscribed: boolean;
  used: number;
  trials: number;
}): QuoteAccess {
  if (!input.live || input.staff || input.subscribed) return "open";
  if (!input.signedIn) return "signup";
  return input.used < input.trials ? "open" : "subscribe";
}
