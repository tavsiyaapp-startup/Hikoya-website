import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateLoginToken } from "@/lib/telegram";

// Starts a "log in via Telegram bot" attempt: mints a one-time token the
// client turns into a t.me/<bot>?start=<token> deep link. The token is
// confirmed out-of-band by auth/telegram-webhook once the user presses
// Start in Telegram, and redeemed by polling auth/telegram-login/[token].
export async function POST() {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return NextResponse.json({ error: "telegram_not_configured" }, { status: 501 });
  }

  const token = generateLoginToken();
  const admin = createAdminClient();
  const { error } = await admin.from("telegram_login_tokens").insert({ token });
  if (error) {
    return NextResponse.json({ error: "token_creation_failed" }, { status: 500 });
  }

  return NextResponse.json({ token, deepLink: `https://t.me/${botUsername}?start=${token}` });
}
