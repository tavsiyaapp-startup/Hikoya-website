import "server-only";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export function generateLoginToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export async function sendTelegramMessage(chatId: number, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    // best-effort — a failed welcome message shouldn't break login
  }
}

export interface TelegramWebhookUpdate {
  message?: {
    text?: string;
    chat: { id: number };
    from?: { id: number; first_name: string; last_name?: string; username?: string };
  };
}

// Finds-or-creates the Supabase user for a confirmed Telegram identity and
// returns the /auth/confirm path that redeems a freshly minted magic link.
// Supabase Auth has no native Telegram provider, so this is our bridge:
// mint a magic-link server-side, hand the browser /auth/confirm to redeem
// it — that's what actually sets the session cookies.
export async function completeTelegramLogin(input: {
  telegramId: number;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  photoUrl?: string | null;
}): Promise<{ confirmPath: string } | { error: string }> {
  const admin = createAdminClient();
  const displayName = [input.firstName, input.lastName].filter(Boolean).join(" ");

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("telegram_id", input.telegramId)
    .maybeSingle();

  let userId = existing?.id as string | undefined;

  if (!userId) {
    const syntheticEmail = `tg-${input.telegramId}@telegram.hikoya.local`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      user_metadata: { full_name: displayName, telegram_username: input.username },
    });
    if (createError || !created.user) return { error: "create_user_failed" };
    userId = created.user.id;

    await admin
      .from("profiles")
      .update({
        telegram_id: input.telegramId,
        display_name: displayName,
        avatar_url: input.photoUrl ?? null,
      })
      .eq("id", userId);
  }

  const { data: userRow } = await admin.auth.admin.getUserById(userId);
  const email = userRow.user?.email;
  if (!email) return { error: "no_email_on_record" };

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link) return { error: "link_failed" };

  return { confirmPath: `/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink` };
}
