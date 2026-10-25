import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, lt, sql, count } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/client";
import {
  chapters,
  paymentClaims,
  paywallSettings,
  profiles,
  quoteTrials,
  stories,
  storyFreeChapters,
  subscriptionEvents,
  subscriptions,
} from "@/server/db/schema";
import {
  authorPublishGate,
  extendExpiry,
  isPaywallAnnounced,
  isPaywallLive,
  isSubscriptionActive,
  type PaywallConfig,
  type PublishGate,
} from "@/server/data/paywall-rules";
import { isStaff, type Viewer } from "@/server/authz/policy";

// «Obuna» database work. The rules themselves are in paywall-rules.ts.
// Every caller treats a failure here (e.g. D:/QIZLAB/backups/paywall.sql
// not run yet) as "subscription off", so the site keeps working as before.

export type PaywallSettingsRow = typeof paywallSettings.$inferSelect;

export interface PaywallState {
  settings: PaywallSettingsRow | null;
  config: PaywallConfig | null;
  live: boolean;
  announced: boolean;
}

export const PAYWALL_OFF: PaywallState = { settings: null, config: null, live: false, announced: false };

export function toConfig(row: PaywallSettingsRow): PaywallConfig {
  return {
    enabled: row.enabled,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    readerFreeChapters: row.reader_free_chapters,
    authorFreeChapters: row.author_free_chapters,
  };
}

export async function loadPaywallState(db: DbOrTx, now = new Date()): Promise<PaywallState> {
  const [row] = await db.select().from(paywallSettings).where(eq(paywallSettings.id, 1)).limit(1);
  if (!row) return PAYWALL_OFF;
  const config = toConfig(row);
  return { settings: row, config, live: isPaywallLive(config, now), announced: isPaywallAnnounced(config, now) };
}

export async function getSubscriptionExpiry(db: DbOrTx, userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ expires_at: subscriptions.expires_at })
    .from(subscriptions)
    .where(eq(subscriptions.user_id, userId))
    .limit(1);
  return row?.expires_at ?? null;
}

export async function hasActiveSubscription(db: DbOrTx, userId: string, now = new Date()): Promise<boolean> {
  return isSubscriptionActive(await getSubscriptionExpiry(db, userId), now);
}

// Admin override of the free chapters for one story (null = the default).
export async function getStoryFreeChapters(db: DbOrTx, storyId: string): Promise<number | null> {
  const [row] = await db
    .select({ free: storyFreeChapters.free_chapters })
    .from(storyFreeChapters)
    .where(eq(storyFreeChapters.story_id, storyId))
    .limit(1);
  return row?.free ?? null;
}

export async function setStoryFreeChapters(db: DbOrTx, storyId: string, free: number | null): Promise<void> {
  if (free === null) {
    await db.delete(storyFreeChapters).where(eq(storyFreeChapters.story_id, storyId));
    return;
  }
  await db
    .insert(storyFreeChapters)
    .values({ story_id: storyId, free_chapters: free })
    .onConflictDoUpdate({ target: storyFreeChapters.story_id, set: { free_chapters: free, updated_at: new Date() } });
}

// --- Authors -------------------------------------------------------------

// Chapters that count as "published by the author": live or waiting for a
// moderator, in stories that aren't in the trash.
async function authorChapterStats(db: DbOrTx, authorId: string, startsAt: Date | null) {
  const own = and(
    eq(stories.author_id, authorId),
    isNull(stories.deleted_at),
    inArray(chapters.status, ["published", "pending_review"])
  );
  const [{ total }] = await db
    .select({ total: count() })
    .from(chapters)
    .innerJoin(stories, eq(stories.id, chapters.story_id))
    .where(own);
  let before = false;
  if (startsAt) {
    const [row] = await db
      .select({ id: chapters.id })
      .from(chapters)
      .innerJoin(stories, eq(stories.id, chapters.story_id))
      .where(and(eq(stories.author_id, authorId), lt(chapters.published_at, startsAt)))
      .limit(1);
    before = Boolean(row);
  }
  return { publishedCount: total, publishedBeforeStart: before };
}

export async function getPublishGate(db: DbOrTx, viewer: Viewer, state: PaywallState, now = new Date()): Promise<PublishGate> {
  if (!state.live || !state.config || isStaff(viewer)) return { allowed: true, freeLeft: null };
  const [subscribed, stats] = await Promise.all([
    hasActiveSubscription(db, viewer.id, now),
    authorChapterStats(db, viewer.id, state.config.startsAt),
  ]);
  return authorPublishGate({
    live: true,
    staff: false,
    subscribed,
    publishedBeforeStart: stats.publishedBeforeStart,
    publishedCount: stats.publishedCount,
    authorFreeChapters: state.config.authorFreeChapters,
  });
}

// --- Granting ------------------------------------------------------------

export async function grantSubscription(
  db: DbOrTx,
  params: { userId: string; days: number; byUserId?: string | null; byTelegram?: string | null; claimId?: string | null },
  now = new Date()
): Promise<Date> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ expires_at: subscriptions.expires_at })
      .from(subscriptions)
      .where(eq(subscriptions.user_id, params.userId))
      .for("update");
    const expiresAt = extendExpiry(current?.expires_at, now, params.days);
    await tx
      .insert(subscriptions)
      .values({ user_id: params.userId, expires_at: expiresAt })
      .onConflictDoUpdate({ target: subscriptions.user_id, set: { expires_at: expiresAt, updated_at: now } });
    await tx.insert(subscriptionEvents).values({
      user_id: params.userId,
      kind: "grant",
      days: params.days,
      expires_at: expiresAt,
      by_user_id: params.byUserId ?? null,
      by_telegram: params.byTelegram ?? null,
      claim_id: params.claimId ?? null,
    });
    return expiresAt;
  });
}

export async function revokeSubscription(db: DbOrTx, userId: string, byUserId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(subscriptions).where(eq(subscriptions.user_id, userId));
    await tx.insert(subscriptionEvents).values({ user_id: userId, kind: "revoke", by_user_id: byUserId });
  });
}

// --- «Toʻladim» → Telegram bot ---------------------------------------------

const CLAIM_REUSE_MS = 24 * 60 * 60 * 1000;

// The token goes into the bot link (t.me/<bot>?start=pay_<token>) — Telegram
// allows up to 64 characters of [A-Za-z0-9_-] there.
export async function createPaymentClaim(db: DbOrTx, userId: string, now = new Date()): Promise<string> {
  const [open] = await db
    .select({ token: paymentClaims.token })
    .from(paymentClaims)
    .where(
      and(
        eq(paymentClaims.user_id, userId),
        inArray(paymentClaims.status, ["new", "awaiting"]),
        gt(paymentClaims.created_at, new Date(now.getTime() - CLAIM_REUSE_MS))
      )
    )
    .orderBy(desc(paymentClaims.created_at))
    .limit(1);
  if (open) return open.token;
  const token = randomBytes(15).toString("base64url");
  await db.insert(paymentClaims).values({ token, user_id: userId });
  return token;
}

export type ClaimRow = typeof paymentClaims.$inferSelect;

export async function findClaimByToken(db: DbOrTx, token: string): Promise<ClaimRow | null> {
  const [row] = await db.select().from(paymentClaims).where(eq(paymentClaims.token, token)).limit(1);
  return row ?? null;
}

export async function findClaimById(db: DbOrTx, id: string): Promise<ClaimRow | null> {
  const [row] = await db.select().from(paymentClaims).where(eq(paymentClaims.id, id)).limit(1);
  return row ?? null;
}

// The claim this Telegram user is about to send a screenshot for.
export async function findAwaitingClaim(db: DbOrTx, telegramUserId: number, now = new Date()): Promise<ClaimRow | null> {
  const [row] = await db
    .select()
    .from(paymentClaims)
    .where(
      and(
        eq(paymentClaims.telegram_user_id, telegramUserId),
        eq(paymentClaims.status, "awaiting"),
        gt(paymentClaims.created_at, new Date(now.getTime() - CLAIM_REUSE_MS))
      )
    )
    .orderBy(desc(paymentClaims.created_at))
    .limit(1);
  return row ?? null;
}

// submitted → approved/rejected exactly once: a second press of the same
// button (or two admins at once) gets null and changes nothing.
export async function resolveClaim(db: DbOrTx, id: string, status: "approved" | "rejected", by: string): Promise<ClaimRow | null> {
  const [row] = await db
    .update(paymentClaims)
    .set({ status, resolved_at: new Date(), resolved_by: by })
    .where(and(eq(paymentClaims.id, id), eq(paymentClaims.status, "submitted")))
    .returning();
  return row ?? null;
}

export async function updateClaim(db: DbOrTx, id: string, values: Partial<Omit<ClaimRow, "id" | "token" | "user_id">>) {
  await db.update(paymentClaims).set(values).where(eq(paymentClaims.id, id));
}

// --- Quote cards -----------------------------------------------------------

export async function getQuoteTrialsUsed(db: DbOrTx, userId: string): Promise<number> {
  const [row] = await db.select({ used: quoteTrials.used }).from(quoteTrials).where(eq(quoteTrials.user_id, userId)).limit(1);
  return row?.used ?? 0;
}

export async function spendQuoteTrial(db: DbOrTx, userId: string): Promise<void> {
  await db
    .insert(quoteTrials)
    .values({ user_id: userId, used: 1 })
    .onConflictDoUpdate({ target: quoteTrials.user_id, set: { used: sql`${quoteTrials.used} + 1` } });
}

// --- Admin -----------------------------------------------------------------

export async function listSubscribers(db: DbOrTx, now = new Date()) {
  return db
    .select({
      user_id: subscriptions.user_id,
      expires_at: subscriptions.expires_at,
      username: profiles.username,
      display_name: profiles.display_name,
      avatar_url: profiles.avatar_url,
    })
    .from(subscriptions)
    .innerJoin(profiles, eq(profiles.id, subscriptions.user_id))
    .where(gt(subscriptions.expires_at, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)))
    .orderBy(desc(subscriptions.expires_at))
    .limit(500);
}

export async function listSubscriptionEvents(db: DbOrTx, limit = 50) {
  return db
    .select({
      id: subscriptionEvents.id,
      kind: subscriptionEvents.kind,
      days: subscriptionEvents.days,
      expires_at: subscriptionEvents.expires_at,
      by_telegram: subscriptionEvents.by_telegram,
      created_at: subscriptionEvents.created_at,
      username: profiles.username,
      display_name: profiles.display_name,
      by_username: sql<string | null>`(select p.username from profiles p where p.id = ${subscriptionEvents.by_user_id})`,
    })
    .from(subscriptionEvents)
    .innerJoin(profiles, eq(profiles.id, subscriptionEvents.user_id))
    .orderBy(desc(subscriptionEvents.created_at))
    .limit(limit);
}

export async function listOpenClaims(db: DbOrTx, now = new Date()) {
  return db
    .select({
      id: paymentClaims.id,
      status: paymentClaims.status,
      created_at: paymentClaims.created_at,
      submitted_at: paymentClaims.submitted_at,
      telegram_username: paymentClaims.telegram_username,
      user_id: paymentClaims.user_id,
      username: profiles.username,
      display_name: profiles.display_name,
    })
    .from(paymentClaims)
    .innerJoin(profiles, eq(profiles.id, paymentClaims.user_id))
    .where(
      and(
        inArray(paymentClaims.status, ["awaiting", "submitted"]),
        gt(paymentClaims.created_at, new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000))
      )
    )
    .orderBy(desc(paymentClaims.created_at))
    .limit(100);
}

export async function countPendingClaims(db: DbOrTx): Promise<number> {
  const [{ total }] = await db.select({ total: count() }).from(paymentClaims).where(eq(paymentClaims.status, "submitted"));
  return total;
}

export async function findProfileByUsername(db: DbOrTx, username: string) {
  const [row] = await db
    .select({ id: profiles.id, username: profiles.username, display_name: profiles.display_name })
    .from(profiles)
    .where(eq(sql`lower(${profiles.username})`, username.toLowerCase()))
    .limit(1);
  return row ?? null;
}
