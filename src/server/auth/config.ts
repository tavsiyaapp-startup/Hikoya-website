import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { emailOTP } from "better-auth/plugins";
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
export const auth = betterAuth({
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
    // Avoids a database read on every request for an already-valid session —
    // see backend_reads.md's note on middleware running on every request.
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
      async sendVerificationOTP({ email, otp }) {
        await sendMail(
          email,
          "Код для входа на Hikoya",
          `Ваш код для входа: ${otp}\n\nКод действует 5 минут. Если вы не запрашивали вход, просто проигнорируйте это письмо.`
        );
      },
    }),
  ],
});
