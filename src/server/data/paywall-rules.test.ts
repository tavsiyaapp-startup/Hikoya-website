import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  authorPublishGate,
  chapterAccess,
  extendExpiry,
  isPaywallAnnounced,
  isPaywallLive,
  isSubscriptionActive,
  quoteAccess,
  type PaywallConfig,
} from "./paywall-rules.ts";

const NOW = new Date("2026-11-10T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const cfg = (over: Partial<PaywallConfig> = {}): PaywallConfig => ({
  enabled: true,
  startsAt: null,
  endsAt: null,
  readerFreeChapters: 3,
  authorFreeChapters: 3,
  ...over,
});

describe("isPaywallLive", () => {
  test("off when disabled or missing", () => {
    assert.equal(isPaywallLive(null, NOW), false);
    assert.equal(isPaywallLive(cfg({ enabled: false }), NOW), false);
  });
  test("on with no dates", () => assert.equal(isPaywallLive(cfg(), NOW), true));
  test("waits for the start date", () => {
    assert.equal(isPaywallLive(cfg({ startsAt: new Date(NOW.getTime() + DAY) }), NOW), false);
    assert.equal(isPaywallLive(cfg({ startsAt: new Date(NOW.getTime() - DAY) }), NOW), true);
  });
  test("ends on the end date", () => {
    assert.equal(isPaywallLive(cfg({ endsAt: NOW }), NOW), false);
    assert.equal(isPaywallLive(cfg({ endsAt: new Date(NOW.getTime() + 1) }), NOW), true);
  });
});

describe("isPaywallAnnounced", () => {
  test("only before a future start date", () => {
    assert.equal(isPaywallAnnounced(cfg({ startsAt: new Date(NOW.getTime() + DAY) }), NOW), true);
    assert.equal(isPaywallAnnounced(cfg({ startsAt: new Date(NOW.getTime() - DAY) }), NOW), false);
    assert.equal(isPaywallAnnounced(cfg(), NOW), false);
    assert.equal(isPaywallAnnounced(cfg({ enabled: false, startsAt: new Date(NOW.getTime() + DAY) }), NOW), false);
  });
});

describe("subscription dates", () => {
  test("active only before expiry", () => {
    assert.equal(isSubscriptionActive(null, NOW), false);
    assert.equal(isSubscriptionActive(new Date(NOW.getTime() - 1), NOW), false);
    assert.equal(isSubscriptionActive(new Date(NOW.getTime() + 1), NOW), true);
  });
  test("a grant starts today when expired, adds on when still active", () => {
    assert.equal(extendExpiry(null, NOW, 30).getTime(), NOW.getTime() + 30 * DAY);
    assert.equal(extendExpiry(new Date(NOW.getTime() - DAY), NOW, 30).getTime(), NOW.getTime() + 30 * DAY);
    const left = new Date(NOW.getTime() + 5 * DAY);
    assert.equal(extendExpiry(left, NOW, 30).getTime(), NOW.getTime() + 35 * DAY);
  });
});

describe("chapterAccess", () => {
  const base = {
    ownerOrStaff: false,
    signedIn: true,
    orderIndex: 1,
    isFreeChapter: false,
    guestFreeChapters: 1,
    live: true,
    freeChapters: 3,
    subscribed: false,
  };
  test("first chapters are free for signed-in readers", () => {
    assert.equal(chapterAccess({ ...base, orderIndex: 3 }), "open");
  });
  test("chapter after the free ones needs a subscription", () => {
    assert.equal(chapterAccess({ ...base, orderIndex: 4 }), "subscribe");
    assert.equal(chapterAccess({ ...base, orderIndex: 4, subscribed: true }), "open");
  });
  test("guests keep the old sign-up rule inside the free chapters", () => {
    assert.equal(chapterAccess({ ...base, signedIn: false, orderIndex: 1 }), "open");
    assert.equal(chapterAccess({ ...base, signedIn: false, orderIndex: 2 }), "signup");
    assert.equal(chapterAccess({ ...base, signedIn: false, orderIndex: 5 }), "subscribe");
  });
  test("owner and staff always read", () => {
    assert.equal(chapterAccess({ ...base, orderIndex: 9, ownerOrStaff: true }), "open");
  });
  test("per-story free count", () => {
    assert.equal(chapterAccess({ ...base, orderIndex: 5, freeChapters: 5 }), "open");
  });
  test("with the subscription off everything works as before", () => {
    assert.equal(chapterAccess({ ...base, live: false, orderIndex: 20 }), "open");
    assert.equal(chapterAccess({ ...base, live: false, signedIn: false, orderIndex: 20 }), "signup");
  });
});

describe("authorPublishGate", () => {
  const base = { live: true, staff: false, subscribed: false, publishedBeforeStart: false, publishedCount: 0, authorFreeChapters: 3 };
  test("new author: three free chapters", () => {
    assert.deepEqual(authorPublishGate(base), { allowed: true, freeLeft: 3 });
    assert.deepEqual(authorPublishGate({ ...base, publishedCount: 2 }), { allowed: true, freeLeft: 1 });
    assert.deepEqual(authorPublishGate({ ...base, publishedCount: 3 }), { allowed: false, freeLeft: 0 });
  });
  test("author who published before the start has no free chapters", () => {
    assert.deepEqual(authorPublishGate({ ...base, publishedBeforeStart: true }), { allowed: false, freeLeft: 0 });
  });
  test("subscription, staff, or subscription off: no limit", () => {
    assert.deepEqual(authorPublishGate({ ...base, publishedBeforeStart: true, subscribed: true }), { allowed: true, freeLeft: null });
    assert.deepEqual(authorPublishGate({ ...base, publishedCount: 9, staff: true }), { allowed: true, freeLeft: null });
    assert.deepEqual(authorPublishGate({ ...base, publishedCount: 9, live: false }), { allowed: true, freeLeft: null });
  });
});

describe("quoteAccess", () => {
  const base = { live: true, signedIn: true, staff: false, subscribed: false, used: 0, trials: 2 };
  test("two trial cards, then subscription", () => {
    assert.equal(quoteAccess(base), "open");
    assert.equal(quoteAccess({ ...base, used: 1 }), "open");
    assert.equal(quoteAccess({ ...base, used: 2 }), "subscribe");
    assert.equal(quoteAccess({ ...base, used: 2, subscribed: true }), "open");
  });
  test("guests sign in first; free for all while off", () => {
    assert.equal(quoteAccess({ ...base, signedIn: false }), "signup");
    assert.equal(quoteAccess({ ...base, live: false, signedIn: false, used: 9 }), "open");
  });
});
