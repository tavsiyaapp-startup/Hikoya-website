import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// While the subscription is on, a quote card (/api/quote) is only drawn with
// a ticket from beginQuote (src/lib/actions/paywall.ts), which is where free
// trials are counted — once per quote, not per style the reader flips
// through. The ticket is an HMAC of chapter + quote + expiry.

const TTL_MS = 6 * 60 * 60 * 1000;

function secret() {
  return process.env.BETTER_AUTH_SECRET ?? "";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueQuoteTicket(chapterId: string, quote: string, now = Date.now()): string {
  const exp = (now + TTL_MS).toString(36);
  return `${exp}.${sign(`${chapterId}|${quote}|${exp}`)}`;
}

export function verifyQuoteTicket(ticket: string | null, chapterId: string, quote: string, now = Date.now()): boolean {
  if (!ticket || !secret()) return false;
  const [exp, mac] = ticket.split(".");
  if (!exp || !mac || parseInt(exp, 36) < now) return false;
  const expected = Buffer.from(sign(`${chapterId}|${quote}|${exp}`));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
