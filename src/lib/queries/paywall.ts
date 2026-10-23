import "server-only";
import { cache } from "react";
import { getDb } from "@/server/db/client";
import { logQueryError } from "@/lib/queries/query-errors";
import { loadViewer } from "@/server/data/viewer";
import type { PublishGate } from "@/server/data/paywall-rules";
import {
  PAYWALL_OFF,
  getPublishGate,
  getStoryFreeChapters,
  getSubscriptionExpiry,
  loadPaywallState,
  type PaywallSettingsRow,
  type PaywallState,
} from "@/server/data/paywall";
import type { Locale } from "@/lib/i18n";
import type { PaywallOffer } from "@/lib/paywall-offer";

export type { PaywallOffer };

// Per-request cached reads for «Obuna». Any failure (e.g. paywall.sql not
// run yet) reads as "subscription off", so pages never break because of it.

export const getPaywallState = cache(async (): Promise<PaywallState> => {
  try {
    return await loadPaywallState(getDb());
  } catch (err) {
    logQueryError("getPaywallState", err);
    return PAYWALL_OFF;
  }
});

export const getMySubscriptionExpiry = cache(async (userId: string | null | undefined): Promise<Date | null> => {
  if (!userId) return null;
  try {
    return await getSubscriptionExpiry(getDb(), userId);
  } catch (err) {
    logQueryError("getMySubscriptionExpiry", err);
    return null;
  }
});

export async function getFreeChaptersForStory(storyId: string, state: PaywallState): Promise<number> {
  const fallback = state.config?.readerFreeChapters ?? 3;
  if (!state.live) return fallback;
  try {
    return (await getStoryFreeChapters(getDb(), storyId)) ?? fallback;
  } catch (err) {
    logQueryError("getFreeChaptersForStory", err);
    return fallback;
  }
}

export function paywallOffer(settings: PaywallSettingsRow | null, locale: Locale): PaywallOffer {
  return {
    price: settings?.price ?? "10 000 soʻm",
    periodDays: settings?.period_days ?? 30,
    cardNumber: settings?.card_number ?? null,
    cardType: settings?.card_type ?? null,
    cardHolder: settings?.card_holder ?? null,
    message: (locale === "ru" ? settings?.message_ru : settings?.message_uz) || null,
    botReady: Boolean(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME),
  };
}

// For the author's own pages (manage, create): may they publish now, and how
// many free chapters are left. Failure = no limit, as with everything here.
export async function getMyPublishGate(userId: string): Promise<PublishGate> {
  const open: PublishGate = { allowed: true, freeLeft: null };
  try {
    const state = await getPaywallState();
    if (!state.live) return open;
    const db = getDb();
    const viewer = await loadViewer(db, userId);
    return viewer ? await getPublishGate(db, viewer, state) : open;
  } catch (err) {
    logQueryError("getMyPublishGate", err);
    return open;
  }
}
