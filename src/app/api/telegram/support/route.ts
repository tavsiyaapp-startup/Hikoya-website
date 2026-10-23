import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb, type Db } from "@/server/db/client";
import { telegramSupportPendingMessages, telegramSupportTickets } from "@/server/db/schema";
import { handlePaymentCallback, handlePaymentMessage } from "@/server/telegram/payment-bot";

// Support/feedback bot, modeled on a reference aiogram bot the user already
// runs elsewhere (long-polling + in-memory dicts). Vercel has no
// always-running process to poll from or hold state in, so this is a
// webhook instead, and the reference's in-memory pending/ticket-counter
// state lives in telegram_support_* tables (migration 0025).
//
// Flow: user DMs the bot -> text/photo/video get queued -> "Отправить
// обращение" button -> everything gets forwarded to the staff group as a
// numbered ticket -> staff reply with /reply <n> <text> in that group ->
// bot relays it back to the user's DM. (No phone number collected — the
// Telegram user id + username already identify who to message back.)

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const SEND_CALLBACK_DATA = "send_appeal";

const SEND_BUTTON_TEXT = "📨 Отправить обращение";
const WELCOME_TEXT =
  "Здравствуйте! Чем можем помочь?\n\n" +
  "Напишите ваш вопрос, отправьте фото или видео. Можно отправить несколько сообщений.\n\n" +
  `Когда закончите — нажмите кнопку «${SEND_BUTTON_TEXT}» ниже.`;
const ACK_TEXT = `✍️ Хотите добавить что-то ещё?\n\nЕсли всё написали — нажмите «${SEND_BUTTON_TEXT}» ниже.`;
const EMPTY_QUEUE_TEXT = "Вы ещё ничего не отправили. Сначала напишите текст обращения, фото или видео.";
const UNSUPPORTED_TYPE_TEXT = "Можно отправлять только текст, фото или видео.";
const CONFIRMATION_TEXT = "Спасибо! Мы получили ваше обращение и свяжемся с вами.";
const REPLY_USAGE_TEXT = "Использование: /reply <номер> <текст>\nНапример: /reply 47 Здравствуйте, ваш вопрос решён";
const TICKET_NOT_FOUND_TEXT = "❌ Обращение с таким номером не найдено.";
const REPLY_FAILED_TEXT = "❌ Не удалось отправить. Пользователь заблокировал бота или ID неверен.";
const REPLY_SENT_TEXT = "✅ Отправлено.";
const FAILURE_TEXT = "Не удалось отправить обращение. Пожалуйста, попробуйте ещё раз чуть позже.";
const TOO_MANY_PENDING_TEXT = "Слишком много сообщений в одном обращении. Нажмите «Отправить обращение» или начните заново командой /start.";
const MAX_PENDING_MESSAGES = 30;
const SEPARATOR = "-".repeat(30);

const REPLY_PATTERN = /^\/reply(?:@\w+)?\s+(\d+)\s+([\s\S]+)$/;

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
  document?: { mime_type?: string };
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

// Never throws: a network error, timeout or a Telegram error response all
// come back as { ok: false } and are logged, so callers can decide what to do
// (before, results were ignored and a failed forward still deleted the
// user's queued messages and told them "received").
async function callTelegram(method: string, payload: Record<string, unknown>): Promise<{ ok: boolean; result?: unknown }> {
  try {
    const res = await fetch(`${TELEGRAM_API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json()) as { ok: boolean; result?: unknown; description?: string };
    if (!body.ok) console.error(`telegram ${method} failed:`, body.description ?? res.status);
    return body;
  } catch (err) {
    console.error(`telegram ${method} failed:`, err);
    return { ok: false };
  }
}

function secretMatches(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function fullName(user: TelegramUser) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ");
}

type AdminClient = Db;

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || !secretMatches(secret, process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const groupChatId = Number(process.env.TELEGRAM_SUPPORT_GROUP_CHAT_ID);
  const admin = getDb();

  let privateChatId: number | null = null;
  try {
    const update = (await request.json()) as TelegramUpdate;
    const chat = update.callback_query?.message?.chat ?? update.message?.chat;
    if (chat && chat.type === "private") privateChatId = chat.id;
    // «Obuna» payments (src/server/telegram/payment-bot.ts) go first; whatever
    // they don't handle is the usual support flow.
    if (update.callback_query) {
      if (!(await handlePaymentCallback(admin, update.callback_query, callTelegram))) {
        await handleCallback(admin, update.callback_query, groupChatId);
      }
    } else if (update.message) {
      if (!(await handlePaymentMessage(admin, update.message, callTelegram))) {
        await handleMessage(admin, update.message, groupChatId);
      }
    }
  } catch (err) {
    console.error("telegram support webhook error", err);
    // Telegram won't retry (we answer 200 below), so at least tell the
    // user their message didn't go through instead of silently dropping it.
    if (privateChatId !== null) await callTelegram("sendMessage", { chat_id: privateChatId, text: FAILURE_TEXT });
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
    await admin.delete(telegramSupportPendingMessages).where(eq(telegramSupportPendingMessages.telegram_user_id, userId));
    await callTelegram("sendMessage", { chat_id: chatId, text: WELCOME_TEXT });
    return;
  }

  if (message.text || message.photo || message.video) {
    const queued = await admin
      .select({ id: telegramSupportPendingMessages.id })
      .from(telegramSupportPendingMessages)
      .where(eq(telegramSupportPendingMessages.telegram_user_id, userId))
      .limit(MAX_PENDING_MESSAGES);
    if (queued.length >= MAX_PENDING_MESSAGES) {
      await callTelegram("sendMessage", { chat_id: chatId, text: TOO_MANY_PENDING_TEXT });
      return;
    }
    await admin.insert(telegramSupportPendingMessages).values({
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

  const pending = await admin
    .select({ chat_id: telegramSupportPendingMessages.chat_id, message_id: telegramSupportPendingMessages.message_id })
    .from(telegramSupportPendingMessages)
    .where(eq(telegramSupportPendingMessages.telegram_user_id, userId))
    .orderBy(asc(telegramSupportPendingMessages.created_at));

  if (pending.length === 0) {
    await callTelegram("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: EMPTY_QUEUE_TEXT,
      show_alert: true,
    });
    return;
  }

  await callTelegram("answerCallbackQuery", { callback_query_id: callback.id });
  await finalizeTicket(admin, callback.from, chatId, pending, groupChatId);
}

async function finalizeTicket(
  admin: AdminClient,
  user: TelegramUser,
  chatId: number,
  pending: { chat_id: number; message_id: number }[],
  groupChatId: number
) {
  const [ticket] = await admin
    .insert(telegramSupportTickets)
    .values({
      telegram_user_id: user.id,
      telegram_username: user.username ?? null,
      telegram_full_name: fullName(user),
    })
    .returning({ ticket_number: telegramSupportTickets.ticket_number });

  const username = user.username ? `@${user.username}` : "без username";
  const header = await callTelegram("sendMessage", {
    chat_id: groupChatId,
    text: `🎫 Обращение #${ticket?.ticket_number}\n${username} ${fullName(user)}`,
  });

  let copied = 0;
  if (header.ok) {
    for (const item of pending) {
      const result = await callTelegram("copyMessage", {
        chat_id: groupChatId,
        from_chat_id: item.chat_id,
        message_id: item.message_id,
      });
      if (result.ok) copied++;
    }
  }

  // Nothing reached the staff group — keep the queued messages so the user
  // can press "send" again, and tell them it failed instead of "received".
  if (!header.ok || copied === 0) {
    await callTelegram("sendMessage", { chat_id: chatId, text: FAILURE_TEXT });
    return;
  }

  await callTelegram("sendMessage", { chat_id: groupChatId, text: SEPARATOR });

  await admin.delete(telegramSupportPendingMessages).where(eq(telegramSupportPendingMessages.telegram_user_id, user.id));

  await callTelegram("sendMessage", { chat_id: chatId, text: CONFIRMATION_TEXT });
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

  const [ticket] = await admin
    .select({ telegram_user_id: telegramSupportTickets.telegram_user_id })
    .from(telegramSupportTickets)
    .where(eq(telegramSupportTickets.ticket_number, ticketNumber))
    .limit(1);

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
