import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { baSessions, baVerifications, collections, comments, profiles, stories } from "@/server/db/schema";
import { isTelegramPlaceholderEmail } from "@/lib/telegram-account";
import { sendMail } from "@/server/auth/mailer";

// Joining a Telegram-only account to the person's older email account.
//
// Someone who couldn't get into their email account signs in with Telegram
// (a new, empty account) and then tries to link that email. The email is
// taken, so its inbox gets a link (config.ts, mailOwnerOfTakenEmail). The
// join needs BOTH proofs in the same browser: the emailed link (owns the
// mailbox) and the Telegram account's own session (owns that Telegram). The
// email's owner clicking a link someone else triggered does nothing — they
// aren't signed in to that stranger's Telegram account.
//
// The email account is kept with everything on it and gets Telegram sign-in;
// what the short-lived Telegram account had of its own (works, comments,
// collections) moves over. Its likes/bookmarks/follows/reading progress are
// not moved (they'd collide with the email account's own). The emptied
// Telegram account is left in place, unreachable: no Telegram, and its
// placeholder email renamed so a later Telegram sign-in can't find it again.

const PREFIX = "tg-merge:";
const TTL_MS = 60 * 60 * 1000;

interface MergeRequest {
  telegramUserId: string;
  email: string;
}

export async function createMergeToken(request: MergeRequest): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await getDb()
    .insert(baVerifications)
    .values({
      id: crypto.randomUUID(),
      identifier: PREFIX + token,
      value: JSON.stringify(request),
      expires_at: new Date(Date.now() + TTL_MS),
    });
  return token;
}

export async function readMergeToken(token: string): Promise<MergeRequest | null> {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return null;
  const [row] = await getDb()
    .select({ value: baVerifications.value })
    .from(baVerifications)
    .where(and(eq(baVerifications.identifier, PREFIX + token), gt(baVerifications.expires_at, new Date())))
    .limit(1);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as MergeRequest;
    return typeof parsed.telegramUserId === "string" && typeof parsed.email === "string" ? parsed : null;
  } catch {
    return null;
  }
}

// The letter to an email that a Telegram-only account tried to link while
// another account already uses it. Its link joins the two accounts — and
// only works in the browser signed in to that Telegram account.
export async function sendMergeOffer(params: { telegramUserId: string; telegramName: string; email: string }) {
  const token = await createMergeToken({ telegramUserId: params.telegramUserId, email: params.email });
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hikoya.org";
  await sendMail(
    params.email,
    "Объединение аккаунтов на Hikoya",
    `Кто-то вошёл на Hikoya через Telegram (имя: ${params.telegramName}) и хочет привязать этот адрес. На него уже зарегистрирован ваш аккаунт.

Если это вы, откройте ссылку на том же устройстве и в том же браузере, где вы только что вошли через Telegram:

${site}/account/merge?token=${token}

Аккаунт с этой почтой останется со всеми вашими произведениями, лайками, закладками и подписками и получит вход через Telegram. Ссылка действует 1 час.

Если это были не вы, ничего не делайте — без входа через тот Telegram ссылка не сработает, и с вашим аккаунтом ничего не произойдёт. Войти в свой аккаунт вы можете как обычно, по коду из письма на ${site}/login`
  );
}

// What the confirmation page shows before the person agrees.
export async function describeMerge(request: MergeRequest) {
  const [target] = await getDb()
    .select({ username: profiles.username, display_name: profiles.display_name })
    .from(profiles)
    .where(eq(profiles.email, request.email))
    .limit(1);
  return target ?? null;
}

export type MergeResult =
  | { ok: true; targetUserId: string }
  | { error: "invalid" | "wrong_account" | "target_missing" | "target_has_telegram" };

// `viewerId` is whoever is signed in where the link was opened — it must be
// the Telegram account that asked for the join.
export async function mergeTelegramAccount(token: string, viewerId: string): Promise<MergeResult> {
  const request = await readMergeToken(token);
  if (!request) return { error: "invalid" };
  if (request.telegramUserId !== viewerId) return { error: "wrong_account" };

  const db = getDb();
  const result = await db.transaction(async (tx): Promise<MergeResult> => {
    const [source] = await tx
      .select({ id: profiles.id, email: profiles.email, telegram_id: profiles.telegram_id })
      .from(profiles)
      .where(eq(profiles.id, viewerId))
      .for("update");
    if (!source || !isTelegramPlaceholderEmail(source.email) || source.telegram_id == null) {
      return { error: "invalid" };
    }
    const [target] = await tx
      .select({ id: profiles.id, telegram_id: profiles.telegram_id })
      .from(profiles)
      .where(eq(profiles.email, request.email))
      .for("update");
    if (!target || target.id === source.id) return { error: "target_missing" };
    if (target.telegram_id != null && target.telegram_id !== source.telegram_id) {
      return { error: "target_has_telegram" };
    }

    const movedStories = await tx
      .update(stories)
      .set({ author_id: target.id })
      .where(eq(stories.author_id, source.id))
      .returning({ id: stories.id });
    await tx.update(comments).set({ user_id: target.id }).where(eq(comments.user_id, source.id));
    await tx.update(collections).set({ owner_id: target.id }).where(eq(collections.owner_id, source.id));
    if (movedStories.length > 0) {
      await tx
        .update(profiles)
        .set({ role: "author" })
        .where(and(eq(profiles.id, target.id), eq(profiles.role, "reader")));
    }

    // Telegram moves last: telegram_id is unique, so it's cleared on the
    // source before being set on the target.
    await tx
      .update(profiles)
      .set({ telegram_id: null, email: `merged-${source.id}@telegram.invalid` })
      .where(eq(profiles.id, source.id));
    await tx.update(profiles).set({ telegram_id: source.telegram_id }).where(eq(profiles.id, target.id));
    await tx.delete(baSessions).where(eq(baSessions.user_id, source.id));
    await tx.delete(baVerifications).where(eq(baVerifications.identifier, PREFIX + token));
    return { ok: true, targetUserId: target.id };
  });

  if ("ok" in result) console.info(`[auth] merged Telegram account ${viewerId} into ${result.targetUserId}`);
  return result;
}
