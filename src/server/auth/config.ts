import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { emailOTP } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { sendMail } from "@/server/auth/mailer";
import { uniqueUsernameFromEmail } from "@/server/data/username";

// profiles plays Better Auth's "user" role directly — same id as the old
// auth.users (so every existing FK into profiles.id keeps working, no
// second user table, no id remapping for 631 existing accounts). See
// backend_additions.sql for the three columns this needs (email,
// email_verified, updated_at) and the ba_accounts/ba_sessions/
// ba_verifications tables Better Auth owns outright.
//
// profiles.id used to be a foreign key to Supabase's auth.users.id. Better
// Auth inserts into profiles directly for a new sign-up, with no auth.users
// row to match, so that constraint had to go — it is dropped on the live
// database (checked 12.10.2026: profiles has no foreign keys).
//
// Table mapping uses the schema-key method from Better Auth's Drizzle
// adapter docs (schema: { ...schema, user: schema.profiles }) — the only
// one shown resolving a model to a differently-named table. `modelName` is
// a second, separately-documented way to do the same thing; mixing both
// on the same model is unverified and risks the two disagreeing about
// which table backs it, so this uses the schema-key method alone.
//
// Built lazily (first call to getAuth(), not at module load) and cached on
// globalThis the same way src/server/db/client.ts caches its pool: `next
// build` imports every route to collect its metadata, and betterAuth()
// calls getDb() eagerly inside this function — building it at module scope
// made `next build` fail outright without a reachable DATABASE_URL, both
// locally and, worse, as a real risk in CI if the database were ever
// briefly unreachable during a deploy's build step.
const BLOCKED_AUTH_PATHS = new Set([
  "/update-user",
  "/delete-user",
  "/change-password",
  "/set-password",
  "/link-social",
  "/unlink-account",
  "/sign-up/email",
]);

function buildAuth() {
  return betterAuth({
    // Without this, Better Auth has no trusted origin to compare the
    // request's Origin header against, and its CSRF check rejects every
    // sign-in with FORBIDDEN/INVALID_ORIGIN — trustedOrigins defaults to
    // just this value. NEXT_PUBLIC_SITE_URL is already set to
    // https://hikoya.org in deploy-self-host.yml's production env.
    baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? "https://hikoya.org",
    // The app sits behind nginx on the same machine, which appends the real
    // client address to X-Forwarded-For. Marking loopback as the trusted
    // proxy makes Better Auth's sign-in rate limit read the address nginx
    // added (rightmost untrusted hop) instead of a value the client could
    // put at the start of the header itself — and stops it from falling
    // back to one shared bucket for everyone when the header has two hops.
    advanced: {
      // profiles.id (Better Auth's user table) is a Postgres uuid column.
      // Better Auth's default ids are 32-char random strings, which Postgres
      // rejects there — so every first sign-in (email code or Google) failed
      // with a 500 while creating the user row. A UUID fits profiles.id and
      // is just as valid in ba_accounts/ba_sessions/ba_verifications, whose
      // id columns are text.
      database: {
        generateId: () => crypto.randomUUID(),
      },
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for"],
        trustedProxies: ["127.0.0.1", "::1"],
      },
    },
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        ...schema,
        user: schema.profiles,
        account: schema.baAccounts,
        session: schema.baSessions,
        verification: schema.baVerifications,
      },
    }),
    user: {
      // Profile settings' "change email" (EditProfileForm.tsx). For an
      // account with a verified email, the CURRENT address gets a link first
      // (sendChangeEmailConfirmation); only once that's opened does Better
      // Auth mail the new address (sendVerificationEmail below), and the
      // change takes effect when that second link is opened. Without the
      // first step, anyone holding a stolen session could move the account
      // to their own mailbox without the owner ever hearing about it.
      changeEmail: {
        enabled: true,
        async sendChangeEmailConfirmation({ user, newEmail, url }) {
          await sendMail(
            user.email,
            "Подтвердите смену e-mail на Hikoya",
            `Кто-то запросил смену e-mail вашего аккаунта на Hikoya на адрес ${newEmail}.

Если это вы, перейдите по ссылке — после этого письмо для подтверждения придёт на новый адрес:

${url}

Если вы ничего не меняли, не переходите по ссылке и смените пароль.`
          );
        },
      },
      fields: {
        email: "email",
        emailVerified: "email_verified",
        name: "display_name",
        image: "avatar_url",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      // profiles.username is NOT NULL + UNIQUE and Better Auth never
      // writes it — without telling Better Auth it exists, its Drizzle
      // schema check refuses to run at all (SCHEMA_MISMATCH), on every
      // request, not just sign-up/sign-in. The real value for a new account
      // is set from its email in databaseHooks.user.create below; this
      // default only covers an insert that somehow skips that hook.
      additionalFields: {
        username: {
          type: "string",
          required: true,
          input: false,
          defaultValue: () => `user_${crypto.randomUUID().slice(0, 8)}`,
        },
        // profiles.role has a DB default ('reader'), so it was never a
        // SCHEMA_MISMATCH problem like username — but without declaring it
        // here, Better Auth strips it from the session's user object, and
        // the admin staff check (src/server/auth/staff.ts) needs it there.
        role: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },
    account: {
      fields: {
        userId: "user_id",
        providerId: "provider_id",
        accountId: "account_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        idToken: "id_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    session: {
      fields: {
        userId: "user_id",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      // Avoids a database read on every request for an already-valid
      // session — see backend_reads.md's note on middleware running on
      // every request. Kept short: until it expires, a signed-out or
      // revoked session still passes in whatever browser holds the cookie.
      cookieCache: { enabled: true, maxAge: 60 },
      // Readers come back every few days or weeks; the 7-day default sent
      // them through the emailed code again far too often. Each visit after
      // a day moves the expiry forward again (updateAge).
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    verification: {
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    emailVerification: {
      async sendVerificationEmail({ user, url }) {
        await sendMail(
          user.email,
          "Подтвердите e-mail на Hikoya",
          `Чтобы подтвердить этот адрес e-mail для вашего аккаунта на Hikoya, перейдите по ссылке:

${url}

Если вы ничего не меняли, просто проигнорируйте это письмо.`
        );
      },
    },
    emailAndPassword: {
      enabled: true,
      // The site never registers through /sign-up/email — new accounts come
      // from the email-code flow (emailOTP below) or Google, both of which
      // prove the person owns the address. Left open, anyone could POST a
      // sign-up with someone else's email and a password of their choice;
      // once the real owner later signed in by code or Google, that
      // attacker's password would still work (account pre-hijacking), and
      // the endpoint also revealed which emails are registered. Password
      // sign-in for existing accounts is unaffected.
      disableSignUp: true,
      // Supabase's bcrypt hashes keep working; see src/server/auth/password.ts.
      password: { hash: hashPassword, verify: verifyPassword },
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      },
    },
    // A new account (first email-code or Google sign-in) gets its username
    // from the email, like the old Supabase trigger did — people never
    // choose it; they set the display name others see during onboarding.
    databaseHooks: {
      user: {
        create: {
          async before(user) {
            const email = typeof user.email === "string" ? user.email : "";
            return { data: { ...user, username: await uniqueUsernameFromEmail(email) } };
          },
        },
      },
    },
    // profiles.has_password drives /login's "you have no password yet, set
    // one" redirect (src/app/login/page.tsx). Better Auth's own password
    // endpoints never touch that column, so a successful reset-by-code (or
    // any successful email+password sign-in, which proves a password
    // exists) flips it here — otherwise the user who just reset their
    // password gets sent to set it a second time.
    hooks: {
      // Better Auth exposes its whole REST API under /api/auth/*. These
      // endpoints are never used by the site, and some of them write straight
      // to profiles (update-user maps name/image to display_name/avatar_url),
      // skipping the site's own checks in updateProfile: blocked accounts,
      // length limits and "avatar must be your own upload". Closed outright.
      before: createAuthMiddleware(async (ctx) => {
        if (BLOCKED_AUTH_PATHS.has(ctx.path)) {
          throw new APIError("NOT_FOUND", { message: "Not available" });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/email-otp/reset-password" && ctx.path !== "/sign-in/email") return;
        const returned = ctx.context.returned;
        if (!returned || returned instanceof Error) return;
        const email = typeof ctx.body?.email === "string" ? ctx.body.email.trim().toLowerCase() : null;
        if (!email) return;
        // The sign-in / reset already succeeded; a failure here must not turn
        // it into an error (the form would then say "wrong password").
        try {
          await getDb().update(schema.profiles).set({ has_password: true }).where(eq(schema.profiles.email, email));
        } catch (err) {
          console.error("[auth] setting has_password failed", email, err);
        }
      }),
    },
    plugins: [
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          // Same plugin instance handles sign-in codes and the admin
          // forgot-password flow (src/app/admin-login/AdminLoginForm.tsx,
          // via authClient.emailOtp.requestPasswordReset) — the wording
          // needs to match which one actually triggered it.
          const subject =
            type === "forget-password" ? "Код для сброса пароля на Hikoya" : "Код для входа на Hikoya";
          const body =
            type === "forget-password"
              ? `Ваш код для сброса пароля: ${otp}\n\nКод действует 5 минут. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.`
              : `Ваш код для входа: ${otp}\n\nКод действует 5 минут. Если вы не запрашивали вход, просто проигнорируйте это письмо.`;
          await sendMail(email, subject, body);
        },
      }),
      // Must be last — it hooks "after" every endpoint to write the session
      // cookie via Next.js's own cookies() API, which only works from a
      // Server Action or Route Handler. Earlier plugins' after-hooks still
      // run first either way; this is about where in Better Auth's own
      // plugin list it sits, not request order.
      nextCookies(),
    ],
  });
}

declare global {
  var __hikoyaAuth: ReturnType<typeof buildAuth> | undefined;
}

export function getAuth() {
  if (!globalThis.__hikoyaAuth) {
    globalThis.__hikoyaAuth = buildAuth();
  }
  return globalThis.__hikoyaAuth;
}
