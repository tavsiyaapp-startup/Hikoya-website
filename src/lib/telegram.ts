import "server-only";
import crypto from "node:crypto";

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

// Telegram Login Widget verification: https://core.telegram.org/widgets/login#checking-authorization
export function verifyTelegramAuth(
  data: TelegramAuthData,
  botToken: string
): { ok: true } | { ok: false; reason: string } {
  const { hash, ...rest } = data;

  const checkString = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${(rest as Record<string, unknown>)[key]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");

  if (computedHash !== hash) {
    return { ok: false, reason: "invalid_hash" };
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - data.auth_date;
  if (ageSeconds > MAX_AUTH_AGE_SECONDS) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true };
}
