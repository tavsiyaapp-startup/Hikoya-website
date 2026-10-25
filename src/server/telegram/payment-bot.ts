import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import {
  findAwaitingClaim,
  findClaimByToken,
  getSubscriptionExpiry,
  grantSubscription,
  loadPaywallState,
  resolveClaim,
  updateClaim,
} from "@/server/data/paywall";

// «Obuna» payments through the support bot (webhook in
// src/app/api/telegram/support/route.ts):
//   1. On the site the reader presses «Toʻladim» → t.me/<bot>?start=pay_<token>
//      (src/lib/actions/paywall.ts). The token ties this Telegram chat to
//      their site account — nobody types a username.
//   2. The bot asks for the payment screenshot; the photo is copied to the
//      payments chat with the account and [Open for N days] [Reject] buttons.
//   3. An admin checks the money arrived and presses a button: the
//      subscription opens (or not) and the bot tells the reader.

type CallTelegram = (method: string, payload: Record<string, unknown>) => Promise<{ ok: boolean; result?: unknown }>;

type TgUser = { id: number; username?: string; first_name: string; last_name?: string };
type TgMessage = {
  message_id: number;
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
  photo?: unknown[];
  document?: { mime_type?: string };
};
type TgCallback = { id: string; data?: string; from: TgUser; message?: TgMessage };

const START_PREFIX = "/start pay_";
const CALLBACK_OK = "sub_ok:";
const CALLBACK_NO = "sub_no:";

const T = {
  askScreenshot: "💜 Hikoya obunasi\n\nToʻlov skrinshotini shu yerga rasm qilib yuboring.",
  linkExpired: "Bu havola eskirgan. Saytda «Toʻladim» tugmasini qayta bosing.",
  alreadyDone: "Bu toʻlov allaqachon koʻrib chiqilgan.",
  received: "✅ Rahmat! Skrinshot adminga yuborildi. Obuna ochilgach, sizga xabar beramiz.",
  sendPhoto: "Iltimos, toʻlov skrinshotini rasm sifatida yuboring.",
  forwardFailed: "Skrinshotni yuborib boʻlmadi. Iltimos, birozdan keyin qayta urinib koʻring.",
  approved: (date: string) => `🎉 Obunangiz ochildi — ${date} gacha. Yoqimli mutolaa!`,
  rejected: "Toʻlov tasdiqlanmadi. Savollaringiz boʻlsa, shu botga yozing.",
};

function paymentsChatId(): number {
  return Number(process.env.TELEGRAM_PAYMENTS_CHAT_ID || process.env.TELEGRAM_SUPPORT_GROUP_CHAT_ID);
}

function tashkentDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" });
}

function who(user: TgUser): string {
  return user.username ? `@${user.username}` : [user.first_name, user.last_name].filter(Boolean).join(" ");
}

// Returns true when the message was a payment step (the support flow then
// leaves it alone).
export async function handlePaymentMessage(db: Db, message: TgMessage, callTelegram: CallTelegram): Promise<boolean> {
  if (message.chat.type !== "private" || !message.from) return false;
  const chatId = message.chat.id;
  const from = message.from;

  if (message.text?.startsWith(START_PREFIX)) {
    const token = message.text.slice(START_PREFIX.length).trim();
    const claim = token ? await findClaimByToken(db, token) : null;
    const open = claim && ["new", "awaiting"].includes(claim.status);
    const fresh = claim && Date.now() - claim.created_at.getTime() < 24 * 60 * 60 * 1000;
    if (!claim || !open || !fresh) {
      await callTelegram("sendMessage", { chat_id: chatId, text: claim && !open ? T.alreadyDone : T.linkExpired });
      return true;
    }
    await updateClaim(db, claim.id, {
      status: "awaiting",
      telegram_user_id: from.id,
      telegram_chat_id: chatId,
      telegram_username: from.username ?? null,
    });
    await callTelegram("sendMessage", { chat_id: chatId, text: T.askScreenshot });
    return true;
  }

  const claim = await findAwaitingClaim(db, from.id);
  if (!claim) return false;

  const isImage = Boolean(message.photo) || Boolean(message.document?.mime_type?.startsWith("image/"));
  if (!isImage) {
    // Text while a screenshot is awaited: a reminder. Commands (plain
    // /start etc.) still go to the support flow.
    if (message.text && !message.text.startsWith("/")) {
      await callTelegram("sendMessage", { chat_id: chatId, text: T.sendPhoto });
      return true;
    }
    return false;
  }

  const [profile] = await db
    .select({ username: profiles.username, display_name: profiles.display_name })
    .from(profiles)
    .where(eq(profiles.id, claim.user_id))
    .limit(1);
  const [state, expiry] = await Promise.all([loadPaywallState(db), getSubscriptionExpiry(db, claim.user_id)]);
  const days = state.settings?.period_days ?? 30;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const caption = [
    "🧾 Obuna toʻlovi / Оплата подписки",
    `Akkaunt: @${profile?.username ?? "?"} (${profile?.display_name ?? ""})`,
    site && profile ? `${site}/author/${profile.username}` : null,
    `Telegram: ${who(from)}`,
    state.settings?.price ? `Narx: ${state.settings.price}` : null,
    expiry && expiry > new Date() ? `Hozirgi obuna: ${tashkentDate(expiry)} gacha` : "Hozir obuna yoʻq",
  ]
    .filter(Boolean)
    .join("\n");

  const copied = await callTelegram("copyMessage", {
    chat_id: paymentsChatId(),
    from_chat_id: chatId,
    message_id: message.message_id,
    caption,
    reply_markup: {
      inline_keyboard: [
        [
          { text: `✅ Ochish (${days} kun)`, callback_data: `${CALLBACK_OK}${claim.id}` },
          { text: "❌ Rad etish", callback_data: `${CALLBACK_NO}${claim.id}` },
        ],
      ],
    },
  });
  if (!copied.ok) {
    await callTelegram("sendMessage", { chat_id: chatId, text: T.forwardFailed });
    return true;
  }
  await updateClaim(db, claim.id, { status: "submitted", submitted_at: new Date() });
  await callTelegram("sendMessage", { chat_id: chatId, text: T.received });
  return true;
}

// Returns true when the callback was a payment button.
export async function handlePaymentCallback(db: Db, callback: TgCallback, callTelegram: CallTelegram): Promise<boolean> {
  const data = callback.data ?? "";
  const approve = data.startsWith(CALLBACK_OK);
  if (!approve && !data.startsWith(CALLBACK_NO)) return false;
  const message = callback.message;
  // Only from the payments chat — a button pressed anywhere else is ignored.
  if (!message || message.chat.id !== paymentsChatId()) {
    await callTelegram("answerCallbackQuery", { callback_query_id: callback.id });
    return true;
  }

  const claimId = data.slice((approve ? CALLBACK_OK : CALLBACK_NO).length);
  const admin = who(callback.from);
  if (!/^[0-9a-f-]{36}$/i.test(claimId)) {
    await callTelegram("answerCallbackQuery", { callback_query_id: callback.id });
    return true;
  }
  // Marking the payment approved and opening the subscription happen
  // together: if the second fails, the first is undone and the button stays.
  const state = await loadPaywallState(db);
  const days = state.settings?.period_days ?? 30;
  let claim: Awaited<ReturnType<typeof resolveClaim>> = null;
  let expires: Date | null = null;
  try {
    const result = await db.transaction(async (tx) => {
      const resolved = await resolveClaim(tx, claimId, approve ? "approved" : "rejected", admin);
      const until =
        resolved && approve
          ? await grantSubscription(tx, { userId: resolved.user_id, days, byTelegram: admin, claimId: resolved.id })
          : null;
      return { resolved, until };
    });
    claim = result.resolved;
    expires = result.until;
  } catch (err) {
    console.error("[payment-bot] resolving a payment failed", claimId, err);
    await callTelegram("answerCallbackQuery", { callback_query_id: callback.id, text: "Xatolik. Qayta bosing.", show_alert: true });
    return true;
  }
  if (!claim) {
    await callTelegram("answerCallbackQuery", { callback_query_id: callback.id, text: T.alreadyDone, show_alert: true });
    await callTelegram("editMessageReplyMarkup", { chat_id: message.chat.id, message_id: message.message_id, reply_markup: { inline_keyboard: [] } });
    return true;
  }

  let resultLine: string;
  if (approve && expires) {
    resultLine = `✅ Ochildi: ${tashkentDate(expires)} gacha — ${admin}`;
    if (claim.telegram_chat_id) await callTelegram("sendMessage", { chat_id: claim.telegram_chat_id, text: T.approved(tashkentDate(expires)) });
  } else {
    resultLine = `❌ Rad etildi — ${admin}`;
    if (claim.telegram_chat_id) await callTelegram("sendMessage", { chat_id: claim.telegram_chat_id, text: T.rejected });
  }

  await callTelegram("answerCallbackQuery", { callback_query_id: callback.id, text: resultLine });
  await callTelegram("editMessageReplyMarkup", { chat_id: message.chat.id, message_id: message.message_id, reply_markup: { inline_keyboard: [] } });
  await callTelegram("sendMessage", { chat_id: message.chat.id, text: resultLine, reply_to_message_id: message.message_id });
  return true;
}
