// An account created by signing in with Telegram has no email of its own,
// but profiles (Better Auth's user table) needs a unique one. It gets a
// placeholder on the reserved ".invalid" domain, which can never receive
// mail — so nobody can sign in to it by email code, and the site knows to
// offer "link an email" instead of showing this address.
export const TELEGRAM_EMAIL_DOMAIN = "telegram.invalid";

export function telegramPlaceholderEmail(telegramId: number | string): string {
  return `tg${telegramId}@${TELEGRAM_EMAIL_DOMAIN}`;
}

export function isTelegramPlaceholderEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${TELEGRAM_EMAIL_DOMAIN}`);
}
