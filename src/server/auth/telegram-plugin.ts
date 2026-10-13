import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, createEmailVerificationToken, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { uniqueUsernameFromEmail } from "@/server/data/username";
import { isTelegramPlaceholderEmail, telegramPlaceholderEmail } from "@/lib/telegram-account";
import { verifyTelegramLogin, type TelegramLoginData } from "@/server/auth/telegram-verify";
import { mergeTelegramAccount, sendMergeOffer } from "@/server/auth/telegram-merge";
import { takeRateLimit } from "@/server/rate-limit";

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

      // Linking a real email to a Telegram-only account. Not Better Auth's
      // own /change-email: for an account whose placeholder is marked
      // verified (old-site Telegram accounts may be) it would first mail the
      // CURRENT address — which doesn't exist. Here the link always goes to
      // the new address, and the email changes once it's opened. A taken
      // address gets the "join accounts" letter instead. Same answer either
      // way, so the form can't be used to find out who is registered.
      linkEmail: createAuthEndpoint(
        "/telegram/link-email",
        { method: "POST", use: [sessionMiddleware] },
        async (ctx) => {
          const { user } = ctx.context.session;
          if (!isTelegramPlaceholderEmail(user.email)) throw new APIError("FORBIDDEN", { message: "NOT_TELEGRAM_ONLY" });
          const email = typeof ctx.body?.email === "string" ? ctx.body.email.trim().toLowerCase() : "";
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || isTelegramPlaceholderEmail(email)) {
            throw new APIError("BAD_REQUEST", { message: "INVALID_EMAIL" });
          }
          if (!takeRateLimit(`link-email:${user.id}`, 5, 60 * 60 * 1000)) {
            throw new APIError("TOO_MANY_REQUESTS", { message: "RATE_LIMITED" });
          }

          const [owner] = await getDb().select({ id: profiles.id }).from(profiles).where(eq(profiles.email, email)).limit(1);
          if (owner) {
            await sendMergeOffer({ telegramUserId: user.id, telegramName: user.name, email });
            return ctx.json({ ok: true });
          }

          const send = ctx.context.options.emailVerification?.sendVerificationEmail;
          if (!send) throw new APIError("INTERNAL_SERVER_ERROR", { message: "MAIL_DISABLED" });
          const token = await createEmailVerificationToken(ctx.context.secret, user.email, email, 60 * 60, {
            requestType: "change-email-verification",
          });
          const callbackURL = typeof ctx.body?.callbackURL === "string" && ctx.body.callbackURL.startsWith("/") ? ctx.body.callbackURL : "/";
          const url = `${ctx.context.baseURL}/verify-email?token=${token}&callbackURL=${encodeURIComponent(callbackURL)}`;
          await send({ user: { ...user, email }, url, token }, ctx.request);
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
