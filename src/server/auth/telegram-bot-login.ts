import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, like, lt } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/client";
import { baVerifications } from "@/server/db/schema";

// Telegram sign-in through the bot's Start button (replaced the Login
// Widget's phone-number popup):
//   1. The site page makes two random values: a public `token` that goes
//      into t.me/<bot>?start=login_<token>, and a `secret` it keeps to itself.
//      It registers both here (/telegram/bot-start in telegram-plugin.ts)
//      and opens Telegram.
//   2. The bot (src/server/telegram/login-bot.ts) gets /start login_<token>
//      and asks «Saytga kirishni tasdiqlaysizmi?»; the button press records
//      who pressed it — Telegram's own id, name and username.
//   3. The page polls /telegram/bot-poll with token + secret and, once
//      confirmed, is signed in. Only the page holding the secret can finish,
//      so a screenshot of the link or the bot chat isn't enough.
// Requests live in Better Auth's ba_verifications (no table of our own);
// they expire after 10 minutes and are deleted once used.

export const TELEGRAM_LOGIN_TTL_MS = 10 * 60 * 1000;
const PREFIX = "tg-login:";
export const LOGIN_TOKEN_RE = /^[A-Za-z0-9_-]{22,43}$/;

export type TelegramLoginUser = { id: number; first_name: string; last_name?: string; username?: string };

export type TelegramLoginState = {
  secret: string; // sha256 of the page's secret
  status: "pending" | "confirmed" | "cancelled";
  mode: "sign-in" | "link";
  userId?: string; // link mode: the signed-in account it was started from
  device?: string;
  tg?: TelegramLoginUser;
};

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function secretMatches(state: TelegramLoginState, secret: string): boolean {
  const a = Buffer.from(state.secret);
  const b = Buffer.from(hashSecret(secret));
  return a.length === b.length && timingSafeEqual(a, b);
}

// "Chrome · Windows" — shown in the bot so a person can tell whether the
// request is really theirs.
export function describeDevice(userAgent: string | null): string {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /YaBrowser/.test(ua)
        ? "Yandex"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Brauzer";
  const os = /iPhone|iPad/.test(ua)
    ? "iPhone"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

export async function createLoginRequest(db: DbOrTx, token: string, state: TelegramLoginState): Promise<boolean> {
  // Old finished-or-abandoned requests go first, so the table never grows.
  await db.delete(baVerifications).where(and(like(baVerifications.identifier, `${PREFIX}%`), lt(baVerifications.expires_at, new Date())));
  const [taken] = await db
    .select({ id: baVerifications.id })
    .from(baVerifications)
    .where(eq(baVerifications.identifier, PREFIX + token))
    .limit(1);
  if (taken) return false;
  await db.insert(baVerifications).values({
    id: crypto.randomUUID(),
    identifier: PREFIX + token,
    value: JSON.stringify(state),
    expires_at: new Date(Date.now() + TELEGRAM_LOGIN_TTL_MS),
  });
  return true;
}

// The request for this token, or null when it doesn't exist or has expired.
export async function readLoginRequest(db: DbOrTx, token: string): Promise<{ id: string; state: TelegramLoginState } | null> {
  if (!LOGIN_TOKEN_RE.test(token)) return null;
  const [row] = await db
    .select({ id: baVerifications.id, value: baVerifications.value, expires_at: baVerifications.expires_at })
    .from(baVerifications)
    .where(eq(baVerifications.identifier, PREFIX + token))
    .limit(1);
  if (!row || row.expires_at.getTime() < Date.now()) return null;
  try {
    return { id: row.id, state: JSON.parse(row.value) as TelegramLoginState };
  } catch {
    return null;
  }
}

export async function saveLoginState(db: DbOrTx, id: string, state: TelegramLoginState) {
  await db.update(baVerifications).set({ value: JSON.stringify(state), updated_at: new Date() }).where(eq(baVerifications.id, id));
}

export async function deleteLoginRequest(db: DbOrTx, id: string) {
  await db.delete(baVerifications).where(eq(baVerifications.id, id));
}
