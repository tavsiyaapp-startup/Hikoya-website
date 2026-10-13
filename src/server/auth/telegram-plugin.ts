import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { uniqueUsernameFromEmail } from "@/server/data/username";
import { isTelegramPlaceholderEmail, telegramPlaceholderEmail } from "@/lib/telegram-account";
import { verifyTelegramLogin, type TelegramLoginData } from "@/server/auth/telegram-verify";
import { mergeTelegramAccount } from "@/server/auth/telegram-merge";

// Sign-in with the Telegram Login Widget, as a Better Auth plugin so the
// session it starts is an ordinary Better Auth session (same cookie, same
// expiry, same sign-out) as email-code and Google sign-ins.
//
// The link lives in profiles.telegram_id (unique) — one Telegram account per
// site account. A Telegram id that isn't linked yet creates a new account
// with a placeholder email (see src/lib/telegram-account.ts); a signed-in
// user links their Telegram from profile settings via /telegram/link
// instead, so they keep one account. Two accounts can't be merged here —
// an admin moves the works between them (transferStoriesAdmin).

function verified(body: unknown): TelegramLoginData {
  const data = verifyTelegramLogin(body, process.env.TELEGRAM_BOT_TOKEN ?? "");
  if (!data) throw new APIError("UNAUTHORIZED", { message: "TELEGRAM_INVALID" });
  return data;
}

async function findByTelegramId(telegramId: number) {
  const [row] = await getDb()
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.telegram_id, telegramId))
    .limit(1);
  return row ?? null;
}

export function telegramAuth(): BetterAuthPlugin {
  return {
    id: "telegram",
    endpoints: {
      signInTelegram: createAuthEndpoint("/telegram/sign-in", { method: "POST" }, async (ctx) => {
        const data = verified(ctx.body);
        const db = getDb();
        let userId = (await findByTelegramId(data.id))?.id ?? null;
        let isNew = false;

        if (!userId) {
          // A previous attempt may have created the account and failed
          // before telegram_id was written — the placeholder email is unique
          // per Telegram id, so it finds that account instead of a duplicate.
          const email = telegramPlaceholderEmail(data.id);
          const existing = await ctx.context.internalAdapter.findUserByEmail(email);
          if (existing) {
            userId = existing.user.id;
          } else {
            const name =
              [data.first_name, data.last_name].filter(Boolean).join(" ").trim().slice(0, 60) ||
              data.username ||
              "Telegram";
            const created = await ctx.context.internalAdapter.createUser(
              { email, emailVerified: false, name },
              { method: "telegram" }
            );
            if (!created) throw new APIError("INTERNAL_SERVER_ERROR", { message: "TELEGRAM_CREATE_FAILED" });
            userId = created.id;
            isNew = true;
            // The create hook derived "tg<id>" from the placeholder; the
            // person's Telegram username is a nicer starting point.
            if (data.username) {
              const username = await uniqueUsernameFromEmail(`${data.username}@telegram`);
              await db.update(profiles).set({ username }).where(eq(profiles.id, userId));
            }
          }
          await db.update(profiles).set({ telegram_id: data.id }).where(eq(profiles.id, userId));
        }

        const user = await ctx.context.internalAdapter.findUserById(userId);
        if (!user) throw new APIError("INTERNAL_SERVER_ERROR", { message: "TELEGRAM_CREATE_FAILED" });
        const session = await ctx.context.internalAdapter.createSession(user.id);
        if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: "TELEGRAM_SESSION_FAILED" });
        await setSessionCookie(ctx, { session, user });
        return ctx.json({ ok: true, isNew });
      }),

      // Adds Telegram sign-in to the account the person is already signed in
      // to. A Telegram already linked to a different account is refused —
      // it would otherwise silently move that person's sign-in here.
      linkTelegram: createAuthEndpoint(
        "/telegram/link",
        { method: "POST", use: [sessionMiddleware] },
        async (ctx) => {
          const data = verified(ctx.body);
          const userId = ctx.context.session.user.id;
          const owner = await findByTelegramId(data.id);
          if (owner && owner.id !== userId) throw new APIError("CONFLICT", { message: "TELEGRAM_TAKEN" });
          await getDb().update(profiles).set({ telegram_id: data.id }).where(eq(profiles.id, userId));
          return ctx.json({ ok: true });
        }
      ),

      // The join confirmed from the emailed link (see telegram-merge.ts).
      // Runs as the Telegram account's own session; on success that session
      // is gone and this browser is signed in to the kept email account.
      mergeTelegram: createAuthEndpoint(
        "/telegram/merge",
        { method: "POST", use: [sessionMiddleware] },
        async (ctx) => {
          const token = typeof ctx.body?.token === "string" ? ctx.body.token : "";
          const result = await mergeTelegramAccount(token, ctx.context.session.user.id);
          if ("error" in result) throw new APIError("BAD_REQUEST", { message: result.error });
          const user = await ctx.context.internalAdapter.findUserById(result.targetUserId);
          if (!user) throw new APIError("INTERNAL_SERVER_ERROR", { message: "target_missing" });
          const session = await ctx.context.internalAdapter.createSession(user.id);
          if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: "TELEGRAM_SESSION_FAILED" });
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ ok: true });
        }
      ),

      // Only for an account that can still sign in another way — a
      // Telegram-only account (placeholder email) would lock itself out.
      unlinkTelegram: createAuthEndpoint(
        "/telegram/unlink",
        { method: "POST", use: [sessionMiddleware] },
        async (ctx) => {
          const { id, email } = ctx.context.session.user;
          if (isTelegramPlaceholderEmail(email)) throw new APIError("FORBIDDEN", { message: "TELEGRAM_ONLY_LOGIN" });
          await getDb().update(profiles).set({ telegram_id: null }).where(eq(profiles.id, id));
          return ctx.json({ ok: true });
        }
      ),
    },
  };
}
