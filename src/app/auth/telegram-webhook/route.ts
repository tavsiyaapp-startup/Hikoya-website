import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTelegramMessage, type TelegramWebhookUpdate } from "@/lib/telegram";

// Telegram POSTs every bot update here (registered once via the Bot API's
// setWebhook, secret_token option — that's the X-Telegram-Bot-Api-Secret-Token
// header checked below). We only care about "/start <token>" messages: they
// confirm a pending auth/telegram-login token and get a welcome reply.
export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await request.json()) as TelegramWebhookUpdate;
  const message = update.message;
  const text = message?.text?.trim();
  const from = message?.from;

  if (!message || !from || !text?.startsWith("/start")) {
    return NextResponse.json({ ok: true });
  }

  const token = text.slice("/start".length).trim();
  if (!token) {
    await sendTelegramMessage(
      message.chat.id,
      "Чтобы войти, откройте эту ссылку с сайта Hikoya и нажмите «Войти через Telegram»."
    );
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("telegram_login_tokens")
    .select("token, status")
    .eq("token", token)
    .maybeSingle();

  if (!row || row.status !== "pending") {
    await sendTelegramMessage(message.chat.id, "Ссылка для входа устарела. Попробуйте войти на сайте ещё раз.");
    return NextResponse.json({ ok: true });
  }

  await admin
    .from("telegram_login_tokens")
    .update({
      status: "confirmed",
      telegram_id: from.id,
      telegram_first_name: from.first_name,
      telegram_last_name: from.last_name ?? null,
      telegram_username: from.username ?? null,
    })
    .eq("token", token);

  await sendTelegramMessage(
    message.chat.id,
    `Добро пожаловать в Hikoya, ${from.first_name}! 🎉 Возвращайтесь на сайт — вход выполнен автоматически.`
  );

  return NextResponse.json({ ok: true });
}
