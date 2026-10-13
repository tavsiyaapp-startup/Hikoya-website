import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// What the Telegram Login Widget hands the page after the person confirms in
// Telegram. Only `hash` proves it came from Telegram — everything else is
// just as easy to fake until verifyTelegramLogin() has checked it.
export interface TelegramLoginData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const FIELDS = ["id", "first_name", "last_name", "username", "photo_url", "auth_date"] as const;
// A confirmation older than this is refused, so a captured one can't be
// replayed days later.
const MAX_AGE_SECONDS = 24 * 60 * 60;

// https://core.telegram.org/widgets/login#checking-authorization — the
// fields (except hash) sorted by name as "key=value" lines, signed with
// HMAC-SHA256 whose key is SHA256(bot token).
export function verifyTelegramLogin(
  raw: unknown,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): TelegramLoginData | null {
  if (!botToken || !raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  if (typeof input.hash !== "string" || !/^[0-9a-f]{64}$/.test(input.hash)) return null;

  const id = Number(input.id);
  const authDate = Number(input.auth_date);
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(authDate)) return null;
  if (nowSeconds - authDate > MAX_AGE_SECONDS || authDate - nowSeconds > 300) return null;

  const lines: string[] = [];
  for (const key of FIELDS) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string" && typeof value !== "number") return null;
    lines.push(`${key}=${value}`);
  }
  lines.sort();

  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(lines.join("\n")).digest();
  const given = Buffer.from(input.hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const text = (v: unknown) => (typeof v === "string" ? v : undefined);
  return {
    id,
    first_name: text(input.first_name),
    last_name: text(input.last_name),
    username: text(input.username),
    photo_url: text(input.photo_url),
    auth_date: authDate,
    hash: input.hash,
  };
}
