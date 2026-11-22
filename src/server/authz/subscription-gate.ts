import "server-only";
import { headers } from "next/headers";
import { getAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { loadViewer } from "@/server/data/viewer";
import { isActive, isStaff, type Viewer } from "@/server/authz/policy";
import { getPaywallState } from "@/lib/queries/paywall";
import { hasActiveSubscription } from "@/server/data/paywall";

export type EngageReason = "unauthorized" | "subscription_required";
export type EngageResult = { ok: true; viewer: Viewer } | { ok: false; reason: EngageReason };

// The gate for "paid" actions under the subscription model: liking, commenting,
// following, bookmarking, collections, forum posts, reading statuses. Reading
// itself is free and never goes through here.
//
// Allowed when the viewer is signed in AND active (not blocked) AND one of:
//   - the paywall is off (test mode / not launched) — nothing is gated yet;
//   - the viewer is staff;
//   - the viewer has an active subscription.
// Otherwise the action is refused with a reason the caller maps to its own
// result shape (null for optimistic toggles, an error code for forms).
export async function engageGate(): Promise<EngageResult> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  const userId = session?.user.id;
  if (!userId) return { ok: false, reason: "unauthorized" };

  const db = getDb();
  const viewer = await loadViewer(db, userId);
  if (!viewer || !isActive(viewer)) return { ok: false, reason: "unauthorized" };

  const state = await getPaywallState();
  if (!state.live || isStaff(viewer)) return { ok: true, viewer };

  const subscribed = await hasActiveSubscription(db, userId);
  return subscribed ? { ok: true, viewer } : { ok: false, reason: "subscription_required" };
}

// Whether the current viewer may perform paid actions right now — used to drive
// the client UI (show the real control vs. a "subscribe" prompt). When the
// paywall is off, everyone can engage (nothing is gated, guests included);
// when it's live, the same rule as engageGate applies.
export async function canEngageNow(): Promise<boolean> {
  const state = await getPaywallState();
  if (!state.live) return true;
  return (await engageGate()).ok;
}
