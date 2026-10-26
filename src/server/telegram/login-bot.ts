import "server-only";
import type { Db } from "@/server/db/client";
import { readLoginRequest, saveLoginState } from "@/server/auth/telegram-bot-login";

// Step 2 of the Telegram sign-in (flow in src/server/auth/telegram-bot-login.ts),
// in the same support bot as «Obuna» payments: /start login_<token> asks the
// person to confirm, and the button press records their Telegram id, name
// and username for the waiting site page.

type CallTelegram = (method: string, payload: Record<string, unknown>) => Promise<{ ok: boolean; result?: unknown }>;

type TgUser = { id: number; username?: string; first_name: string; last_name?: string };
type TgMessage = { message_id: number; chat: { id: number; type: string }; from?: TgUser; text?: string };
type TgCallback = { id: string; data?: string; from: TgUser; message?: TgMessage };

const START_PREFIX = "/start login_";
const CALLBACK_OK = "tgl_ok:";
const CALLBACK_NO = "tgl_no:";

const T = {
  askSignIn: (device: string) =>
    `🔐 Hikoya saytiga kirish\n\n${device} orqali kirish soʻraldi. Bu siz boʻlsangiz, «Ha, kirish» tugmasini bosing.\n\nAgar siz soʻramagan boʻlsangiz, hech narsani bosmang.`,
  askLink: (device: string) =>
    `🔗 Telegramni Hikoya profilingizga ulash\n\n${device} orqali soʻraldi. Bu siz boʻlsangiz, «Ha, ulash» tugmasini bosing.`,
  yesSignIn: "✅ Ha, kirish",
  yesLink: "✅ Ha, ulash",
  no: "❌ Yoʻq",
  expired: "Bu havola eskirgan. Saytda «Telegram orqali kirish» tugmasini qayta bosing.",
  confirmed: "✅ Tasdiqlandi. Saytga qayting — u oʻzi kiradi.",
  cancelled: "❌ Bekor qilindi. Hech kim kirmadi.",
};

// Returns true when the message was a sign-in step (other handlers then
// leave it alone).
export async function handleLoginMessage(db: Db, message: TgMessage, callTelegram: CallTelegram): Promise<boolean> {
  if (message.chat.type !== "private" || !message.from || !message.text?.startsWith(START_PREFIX)) return false;
  const token = message.text.slice(START_PREFIX.length).trim();
  // The page opens Telegram first and registers the request right after (a
  // popup must open straight from the click) — a very quick Start can beat
  // it, so a missing request gets one more look.
  let request = await readLoginRequest(db, token);
  if (!request) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    request = await readLoginRequest(db, token);
  }
  if (!request || request.state.status !== "pending") {
    await callTelegram("sendMessage", { chat_id: message.chat.id, text: T.expired });
    return true;
  }
  const link = request.state.mode === "link";
  const device = request.state.device ?? "Brauzer";
  await callTelegram("sendMessage", {
    chat_id: message.chat.id,
    text: link ? T.askLink(device) : T.askSignIn(device),
    reply_markup: {
      inline_keyboard: [
        [
          { text: link ? T.yesLink : T.yesSignIn, callback_data: CALLBACK_OK + token },
          { text: T.no, callback_data: CALLBACK_NO + token },
        ],
      ],
    },
  });
  return true;
}

export async function handleLoginCallback(db: Db, callback: TgCallback, callTelegram: CallTelegram): Promise<boolean> {
  const data = callback.data ?? "";
  const ok = data.startsWith(CALLBACK_OK);
  if (!ok && !data.startsWith(CALLBACK_NO)) return false;
  const token = data.slice((ok ? CALLBACK_OK : CALLBACK_NO).length);
  const request = await readLoginRequest(db, token);
  const message = callback.message;

  let reply = T.expired;
  if (request && request.state.status === "pending") {
    const { id, first_name, last_name, username } = callback.from;
    await saveLoginState(
      db,
      request.id,
      ok
        ? { ...request.state, status: "confirmed", tg: { id, first_name, last_name, username } }
        : { ...request.state, status: "cancelled" }
    );
    reply = ok ? T.confirmed : T.cancelled;
  }
  // The question turns into the answer, buttons gone — nothing to press twice.
  if (message) {
    await callTelegram("editMessageText", { chat_id: message.chat.id, message_id: message.message_id, text: reply });
  }
  await callTelegram("answerCallbackQuery", { callback_query_id: callback.id });
  return true;
}
