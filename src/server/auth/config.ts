import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { emailOTP } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { sendMail } from "@/server/auth/mailer";

// profiles plays Better Auth's "user" role directly — same id as the old
// auth.users (so every existing FK into profiles.id keeps working, no
// second user table, no id remapping for 631 existing accounts). See
// backend_additions.sql for the three columns this needs (email,
// email_verified, updated_at) and the ba_accounts/ba_sessions/
// ba_verifications tables Better Auth owns outright.
//
// profiles.id currently has a foreign key to auth.users.id, left over from
// when Supabase Auth created that row first. Better Auth inserts into
// profiles directly for a new sign-up, with no auth.users row to match —
// that FK must be dropped (after the one-time data migration out of
// auth.users/auth.identities) or every new registration fails. Not done
// yet; see D:\QIZLAB\backups\auth_migration.sql.
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
function buildAuth() {
  return betterAuth({
    // Without this, Better Auth has no trusted origin to compare the
    // request's Origin header against, and its CSRF check rejects every
    // sign-in with FORBIDDEN/INVALID_ORIGIN — trustedOrigins defaults to
    // just this value. NEXT_PUBLIC_SITE_URL is already set to
    // https://hikoya.org in deploy-self-host.yml's production env.
    baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? "https://hikoya.org",
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
      // request, not just sign-up/sign-in. Real registration (email/
      // password sign-up, first Google sign-in) still goes through
      // Supabase, not Better Auth, so this is only a placeholder that
      // keeps an accidental Better Auth-driven insert from crashing on
      // the constraint — replace with real username assignment before
      // Better Auth itself ever creates a profiles row.
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
      // every request.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    verification: {
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    emailAndPassword: {
      enabled: true,
      // Supabase's bcrypt hashes keep working; see src/server/auth/password.ts.
      password: { hash: hashPassword, verify: verifyPassword },
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      },
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
