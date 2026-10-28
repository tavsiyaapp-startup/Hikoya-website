"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getAuth } from "@/server/auth/config";
import { getStaffSession } from "@/server/auth/staff";
import { getDb } from "@/server/db/client";
import { chapters, paywallSettings, stories } from "@/server/db/schema";
import { loadViewer } from "@/server/data/viewer";
import { canViewChapter, isStaff } from "@/server/authz/policy";
import { takeRateLimit } from "@/server/rate-limit";
import { chapterAccess, isSubscriptionActive, quoteAccess } from "@/server/data/paywall-rules";
import {
  createPaymentClaim,
  findProfileByUsername,
  getQuoteTrialsUsed,
  getStoryFreeChapters,
  getSubscriptionExpiry,
  grantSubscription,
  loadPaywallState,
  revokeSubscription,
  setStoryFreeChapters,
  spendQuoteTrial,
} from "@/server/data/paywall";
import { issueQuoteTicket } from "@/server/data/quote-ticket";
import { normalizeCardNumber, isValidCardNumber } from "@/server/data/donations";
import { LOCAL_CARD_TYPES, INTL_CARD_TYPES } from "@/lib/card";
import { ROUTES } from "@/lib/constants";

// «Obuna» server actions: the reader's «Toʻladim» button, quote-card trials,
// and the admin side (/admin/subscriptions, per-story free chapters).

// «Toʻladim»: makes (or reuses) a payment claim and returns the Telegram
// link that opens the bot with it — the bot then knows which site account
// the screenshot belongs to (src/app/api/telegram/support/route.ts).
export async function startPaymentClaim(): Promise<{ url: string } | { error: "signin" | "nobot" | "rate" | "failed" }> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return { error: "signin" };
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  if (!bot) return { error: "nobot" };
  if (!takeRateLimit(`pay-claim:${session.user.id}`, 10, 60 * 60 * 1000)) return { error: "rate" };
  try {
    const token = await createPaymentClaim(getDb(), session.user.id);
    return { url: `https://t.me/${bot}?start=pay_${token}` };
  } catch (err) {
    console.error("[paywall] startPaymentClaim failed", err);
    return { error: "failed" };
  }
}

// Called when a reader opens the quote maker. While the subscription is on:
// guests sign in first, non-subscribers spend one of their free cards, and
// the answer carries a ticket /api/quote checks (src/server/data/quote-ticket.ts).
export async function beginQuote(
  chapterId: string,
  rawQuote: string
): Promise<{ ok: true; ticket: string | null; trialsLeft: number | null } | { ok: false; reason: "signup" | "subscribe" | "failed" }> {
  const quote = rawQuote.replace(/\s+/g, " ").trim();
  try {
    const db = getDb();
    const state = await loadPaywallState(db).catch(() => null);
    if (!state?.live || !state.settings) return { ok: true, ticket: null, trialsLeft: null };

    const session = await getAuth().api.getSession({ headers: await headers() });
    const viewer = session ? await loadViewer(db, session.user.id) : null;

    const [row] = await db
      .select({
        chapter: { id: chapters.id, story_id: chapters.story_id, status: chapters.status, order_index: chapters.order_index, is_free: chapters.is_free },
        story: { id: stories.id, author_id: stories.author_id, status: stories.status, visibility: stories.visibility, deleted_at: stories.deleted_at },
      })
      .from(chapters)
      .innerJoin(stories, eq(stories.id, chapters.story_id))
      .where(eq(chapters.id, chapterId))
      .limit(1);
    if (!row || !canViewChapter(viewer, row.chapter, row.story)) return { ok: false, reason: "failed" };

    const staff = isStaff(viewer);
    const owner = viewer?.id === row.story.author_id;
    const subscribed = viewer ? isSubscriptionActive(await getSubscriptionExpiry(db, viewer.id), new Date()) : false;
    const free = (await getStoryFreeChapters(db, row.story.id)) ?? state.settings.reader_free_chapters;
    const canRead = chapterAccess({
      ownerOrStaff: owner || staff,
      signedIn: Boolean(viewer),
      orderIndex: row.chapter.order_index,
      isFreeChapter: row.chapter.is_free,
      guestFreeChapters: Number.MAX_SAFE_INTEGER,
      live: true,
      freeChapters: free,
      subscribed,
    });
    if (canRead !== "open") return { ok: false, reason: canRead === "subscribe" ? "subscribe" : "signup" };

    const used = viewer ? await getQuoteTrialsUsed(db, viewer.id) : 0;
    const access = quoteAccess({
      live: true,
      signedIn: Boolean(viewer),
      staff: staff || owner,
      subscribed,
      used,
      trials: state.settings.quote_trials,
    });
    if (access !== "open") return { ok: false, reason: access };

    let trialsLeft: number | null = null;
    if (viewer && !staff && !owner && !subscribed) {
      await spendQuoteTrial(db, viewer.id);
      trialsLeft = Math.max(0, state.settings.quote_trials - used - 1);
    }
    return { ok: true, ticket: issueQuoteTicket(chapterId, quote), trialsLeft };
  } catch (err) {
    console.error("[paywall] beginQuote failed", err);
    return { ok: false, reason: "failed" };
  }
}

// --- Admin -----------------------------------------------------------------

// Money matters: settings and grants are for admins only, not moderators.
async function requirePaywallAdmin() {
  const result = await getStaffSession();
  if (result.status !== "staff" || !result.staff.isAdmin) return null;
  return result.staff;
}

export type PaywallAdminResult = { ok: true; message?: string } | { ok: false; error: string };

function parseLocalDate(raw: FormDataEntryValue | null): Date | null | "invalid" {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  // <input type="datetime-local"> sends local time without a zone; the
  // admin works in Tashkent time (UTC+5, no daylight saving).
  const d = new Date(`${value}:00+05:00`);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

function intField(formData: FormData, name: string, min: number, max: number): number | null {
  const n = Number(formData.get(name));
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export async function savePaywallSettings(_prev: PaywallAdminResult | null, formData: FormData): Promise<PaywallAdminResult> {
  const admin = await requirePaywallAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const enabled = formData.get("enabled") === "on";
  let startsAt = parseLocalDate(formData.get("startsAt"));
  const endsAt = parseLocalDate(formData.get("endsAt"));
  if (startsAt === "invalid" || endsAt === "invalid") return { ok: false, error: "date" };
  // The start date also marks who counts as an "existing" author, so turning
  // it on always fixes one.
  if (enabled && !startsAt) startsAt = new Date();
  if (startsAt && endsAt && endsAt <= startsAt) return { ok: false, error: "dateOrder" };

  const readerFree = intField(formData, "readerFreeChapters", 0, 1000);
  const authorFree = intField(formData, "authorFreeChapters", 0, 1000);
  const periodDays = intField(formData, "periodDays", 1, 3660);
  const quoteTrials = intField(formData, "quoteTrials", 0, 1000);
  if (readerFree === null || authorFree === null || periodDays === null || quoteTrials === null) return { ok: false, error: "number" };

  const price = String(formData.get("price") ?? "").trim().slice(0, 60);
  const cardNumber = normalizeCardNumber(String(formData.get("cardNumber") ?? ""));
  const cardType = String(formData.get("cardType") ?? "");
  if (cardNumber && !isValidCardNumber(cardNumber)) return { ok: false, error: "card" };
  const knownType = [...LOCAL_CARD_TYPES, ...INTL_CARD_TYPES].find((x) => x === cardType) ?? null;
  const cardHolder = String(formData.get("cardHolder") ?? "").trim().slice(0, 60);
  const messageUz = String(formData.get("messageUz") ?? "").trim().slice(0, 1000);
  const messageRu = String(formData.get("messageRu") ?? "").trim().slice(0, 1000);

  try {
    await getDb()
      .update(paywallSettings)
      .set({
        enabled,
        starts_at: startsAt,
        ends_at: endsAt,
        reader_free_chapters: readerFree,
        author_free_chapters: authorFree,
        period_days: periodDays,
        quote_trials: quoteTrials,
        price: price || "10 000 soʻm",
        card_number: cardNumber || null,
        card_type: cardNumber ? knownType : null,
        card_holder: cardHolder || null,
        message_uz: messageUz || null,
        message_ru: messageRu || null,
        updated_at: new Date(),
      })
      .where(eq(paywallSettings.id, 1));
  } catch (err) {
    console.error("[paywall] savePaywallSettings failed", err);
    return { ok: false, error: "failed" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function grantSubscriptionByUsername(_prev: PaywallAdminResult | null, formData: FormData): Promise<PaywallAdminResult> {
  const admin = await requirePaywallAdmin();
  if (!admin) return { ok: false, error: "forbidden" };
  const username = String(formData.get("username") ?? "").trim().replace(/^@/, "");
  const days = intField(formData, "days", 1, 3660);
  if (!username || days === null) return { ok: false, error: "input" };
  try {
    const db = getDb();
    const profile = await findProfileByUsername(db, username);
    if (!profile) return { ok: false, error: "notFound" };
    const expires = await grantSubscription(db, { userId: profile.id, days, byUserId: admin.id });
    revalidatePath(`${ROUTES.admin}/subscriptions`);
    return { ok: true, message: `@${profile.username}|${expires.toISOString()}` };
  } catch (err) {
    console.error("[paywall] grantSubscriptionByUsername failed", err);
    return { ok: false, error: "failed" };
  }
}

// One-click grant from the users list (/admin/users) — the same thing the
// bot's ✅ button does, but without the Telegram payment flow, for when the
// money was handled off-platform. Admin only (money), default period from
// the paywall settings. Returns the new expiry so the row can show it.
export async function grantSubscriptionToUser(userId: string): Promise<{ ok: true; until: string } | { ok: false }> {
  const admin = await requirePaywallAdmin();
  if (!admin) return { ok: false };
  try {
    const db = getDb();
    const state = await loadPaywallState(db);
    const days = state.settings?.period_days ?? 30;
    const expires = await grantSubscription(db, { userId, days, byUserId: admin.id });
    revalidatePath(`${ROUTES.admin}/users`);
    revalidatePath(`${ROUTES.admin}/subscriptions`);
    return { ok: true, until: expires.toISOString() };
  } catch (err) {
    console.error("[paywall] grantSubscriptionToUser failed", err);
    return { ok: false };
  }
}

export async function revokeSubscriptionAction(userId: string): Promise<boolean> {
  const admin = await requirePaywallAdmin();
  if (!admin) return false;
  try {
    await revokeSubscription(getDb(), userId, admin.id);
    revalidatePath(`${ROUTES.admin}/subscriptions`);
    return true;
  } catch (err) {
    console.error("[paywall] revokeSubscription failed", err);
    return false;
  }
}

// Per-story free chapters (empty = the default from the settings).
export async function setStoryFreeChaptersAction(storyId: string, raw: string): Promise<boolean> {
  const admin = await requirePaywallAdmin();
  if (!admin) return false;
  const value = raw.trim();
  const n = value === "" ? null : Number(value);
  if (n !== null && (!Number.isInteger(n) || n < 0 || n > 1000)) return false;
  try {
    await setStoryFreeChapters(getDb(), storyId, n);
    revalidatePath(`${ROUTES.admin}/stories/${storyId}`);
    return true;
  } catch (err) {
    console.error("[paywall] setStoryFreeChapters failed", err);
    return false;
  }
}
