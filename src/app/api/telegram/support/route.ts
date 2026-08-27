import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Support/feedback bot, modeled on a reference aiogram bot the user already
// runs elsewhere (long-polling + in-memory dicts). Vercel has no
// always-running process to poll from or hold state in, so this is a
// webhook instead, and the reference's in-memory pending/awaiting_phone/
// ticket-counter state lives in telegram_support_* tables (migration 0025).
//
// Flow: user DMs the bot -> text/photo/video get queued -> "Отправить
// обращение" button -> phone number -> everything gets forwarded to the
// staff group as a numbered ticket -> staff reply with /reply <n> <text> in
// that group -> bot relays it back to the user's DM.

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const SEND_CALLBACK_DATA = "send_appeal";

const SEND_BUTTON_TEXT = "📨 Отправить обращение";
const SHARE_CONTACT_BUTTON = "📞 Отправить номер";
const WELCOME_TEXT =
  "Здравствуйте! Чем можем помочь?\n\n" +
  "Напишите ваш вопрос, отправьте фото или видео. Можно отправить несколько сообщений.\n\n" +
  `Когда закончите — нажмите кнопку «${SEND_BUTTON_TEXT}» ниже.`;
const ACK_TEXT = `✍️ Хотите добавить что-то ещё?\n\nЕсли всё написали — нажмите «${SEND_BUTTON_TEXT}» ниже.`;
const EMPTY_QUEUE_TEXT = "Вы ещё ничего не отправили. Сначала напишите текст обращения, фото или видео.";
const UNSUPPORTED_TYPE_TEXT = "Можно отправлять только текст, фото или видео.";
const CONFIRMATION_TEXT = "Спасибо! Мы получили ваше обращение и свяжемся с вами.";
const PHONE_REQUEST_TEXT = "Отправьте, пожалуйста, номер телефона для связи.";
const REPLY_USAGE_TEXT = "Использование: /reply <номер> <текст>\nНапример: /reply 47 Здравствуйте, ваш вопрос решён";
const TICKET_NOT_FOUND_TEXT = "❌ Обращение с таким номером не найдено.";
const REPLY_FAILED_TEXT = "❌ Не удалось отправить. Пользователь заблокировал бота или ID неверен.";
const REPLY_SENT_TEXT = "✅ Отправлено.";
const SEPARATOR = "-".repeat(30);

const REPLY_PATTERN = /^\/reply(?:@\w+)?\s+(\d+)\s+([\s\S]+)$/;
const PHONE_KEYBOARD = {
  keyboard: [[{ text: SHARE_CONTACT_BUTTON, request_contact: true }]],
  resize_keyboard: true,
};

type TelegramUser = {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
};

type TelegramMessage = {
  message_id: number;
  chat: { id: number; type: string };
  from?: TelegramUser;
  text?: string;
  photo?: unknown[];
  video?: unknown;
  contact?: { phone_number: string };
};

type TelegramUpdate = {
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    data?: string;
    from: TelegramUser;
    message?: TelegramMessage;
  };
};

async function callTelegram(method: string, payload: Record<string, unknown>) {
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ ok: boolean; result?: unknown }>;
}

function fullName(user: TelegramUser) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ");
}

type AdminClient = ReturnType<typeof createAdminClient>;

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const groupChatId = Number(process.env.TELEGRAM_SUPPORT_GROUP_CHAT_ID);
  const admin = createAdminClient();

  try {
    const update = (await request.json()) as TelegramUpdate;
    if (update.callback_query) {
      await handleCallback(admin, update.callback_query, groupChatId);
    } else if (update.message) {
      await handleMessage(admin, update.message, groupChatId);
    }
  } catch (err) {
    console.error("telegram support webhook error", err);
  }

  // Always 200 — a non-2xx response makes Telegram retry the same update.
  return NextResponse.json({ ok: true });
}

async function handleMessage(admin: AdminClient, message: TelegramMessage, groupChatId: number) {
  const chatId = message.chat.id;

  if (chatId === groupChatId) {
    if (message.text?.startsWith("/reply")) await handleReplyCommand(admin, message);
    return;
  }

  if (message.chat.type !== "private" || !message.from) return;
  const userId = message.from.id;

  if (message.text === "/start") {
    await admin.from("telegram_support_pending_messages").delete().eq("telegram_user_id", userId);
    await admin.from("telegram_support_sessions").delete().eq("telegram_user_id", userId);
    await callTelegram("sendMessage", { chat_id: chatId, text: WELCOME_TEXT, reply_markup: { remove_keyboard: true } });
    return;
  }

  const { data: session } = await admin
    .from("telegram_support_sessions")
    .select("awaiting_phone")
    .eq("telegram_user_id", userId)
    .maybeSingle();

  if (session?.awaiting_phone) {
    const phone = message.contact?.phone_number ?? message.text;
    if (!phone) {
      await callTelegram("sendMessage", { chat_id: chatId, text: PHONE_REQUEST_TEXT, reply_markup: PHONE_KEYBOARD });
      return;
    }
    await finalizeTicket(admin, message.from, chatId, phone, groupChatId);
    return;
  }

  if (message.text || message.photo || message.video) {
    await admin.from("telegram_support_pending_messages").insert({
      telegram_user_id: userId,
      chat_id: chatId,
      message_id: message.message_id,
    });
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: ACK_TEXT,
      reply_markup: { inline_keyboard: [[{ text: SEND_BUTTON_TEXT, callback_data: SEND_CALLBACK_DATA }]] },
    });
    return;
  }

  await callTelegram("sendMessage", { chat_id: chatId, text: UNSUPPORTED_TYPE_TEXT });
}

async function handleCallback(
  admin: AdminClient,
  callback: NonNullable<TelegramUpdate["callback_query"]>,
  groupChatId: number
) {
  if (callback.data !== SEND_CALLBACK_DATA || !callback.message) return;
  const chatId = callback.message.chat.id;
  if (chatId === groupChatId) return;
  const userId = callback.from.id;

  const { count } = await admin
    .from("telegram_support_pending_messages")
    .select("*", { count: "exact", head: true })
    .eq("telegram_user_id", userId);

  if (!count) {
    await callTelegram("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: EMPTY_QUEUE_TEXT,
      show_alert: true,
    });
    return;
  }

  await admin
    .from("telegram_support_sessions")
    .upsert({ telegram_user_id: userId, awaiting_phone: true, updated_at: new Date().toISOString() });
  await callTelegram("answerCallbackQuery", { callback_query_id: callback.id });
  await callTelegram("sendMessage", { chat_id: chatId, text: PHONE_REQUEST_TEXT, reply_markup: PHONE_KEYBOARD });
}

async function finalizeTicket(
  admin: AdminClient,
  user: TelegramUser,
  chatId: number,
  phone: string,
  groupChatId: number
) {
  const { data: pending } = await admin
    .from("telegram_support_pending_messages")
    .select("chat_id, message_id")
    .eq("telegram_user_id", user.id)
    .order("created_at", { ascending: true });

  const { data: ticket } = await admin
    .from("telegram_support_tickets")
    .insert({
      telegram_user_id: user.id,
      telegram_username: user.username ?? null,
      telegram_full_name: fullName(user),
      phone,
    })
    .select("ticket_number")
    .single();

  const username = user.username ? `@${user.username}` : "без username";
  await callTelegram("sendMessage", {
    chat_id: groupChatId,
    text: `🎫 Обращение #${ticket?.ticket_number}\n${username} ${fullName(user)}`,
  });

  for (const item of pending ?? []) {
    await callTelegram("copyMessage", {
      chat_id: groupChatId,
      from_chat_id: item.chat_id,
      message_id: item.message_id,
    });
  }

  await callTelegram("sendMessage", { chat_id: groupChatId, text: `📞 Телефон: ${phone}` });
  await callTelegram("sendMessage", { chat_id: groupChatId, text: SEPARATOR });

  await admin.from("telegram_support_pending_messages").delete().eq("telegram_user_id", user.id);
  await admin.from("telegram_support_sessions").delete().eq("telegram_user_id", user.id);

  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: CONFIRMATION_TEXT,
    reply_markup: { remove_keyboard: true },
  });
}

async function handleReplyCommand(admin: AdminClient, message: TelegramMessage) {
  const match = message.text?.match(REPLY_PATTERN);
  if (!match) {
    await callTelegram("sendMessage", {
      chat_id: message.chat.id,
      text: REPLY_USAGE_TEXT,
      reply_to_message_id: message.message_id,
    });
    return;
  }

  const ticketNumber = Number(match[1]);
  const replyText = match[2].trim();

  const { data: ticket } = await admin
    .from("telegram_support_tickets")
    .select("telegram_user_id")
    .eq("ticket_number", ticketNumber)
    .maybeSingle();

  if (!ticket) {
    await callTelegram("sendMessage", {
      chat_id: message.chat.id,
      text: TICKET_NOT_FOUND_TEXT,
      reply_to_message_id: message.message_id,
    });
    return;
  }

  const result = await callTelegram("sendMessage", { chat_id: ticket.telegram_user_id, text: replyText });
  await callTelegram("sendMessage", {
    chat_id: message.chat.id,
    text: result.ok ? REPLY_SENT_TEXT : REPLY_FAILED_TEXT,
    reply_to_message_id: message.message_id,
  });
}
