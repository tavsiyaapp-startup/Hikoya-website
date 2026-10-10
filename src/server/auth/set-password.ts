import "server-only";
import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/client";
import { baAccounts } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";

// Sets (or replaces) the credential account backing email+password sign-in
// for an already-authenticated user — used from a Server Action that
// already has their session, so unlike Better Auth's public forgot-
// password flow (src/server/auth/config.ts's emailOTP plugin), no email/
// OTP re-verification is needed here; the session itself is the proof.
//
// account_id MUST equal the user's own id, not their email — confirmed by
// reading Better Auth's own sign-in-with-password code (node_modules/
// better-auth/dist/api/routes/sign-in.mjs) and its findCredentialAccount
// (node_modules/better-auth/dist/db/internal-adapter.mjs), both of which
// look up the credential account by { userId, providerId: "credential" }
// and then require accountId === userId specifically. The original
// D:\QIZLAB\backups\auth_migration.sql used lower(email) instead — flagged
// there as "an unverified assumption" — which this now proves wrong: see
// 0049_fix_ba_accounts_credential_id.sql for the one-time fix applied to
// the 525 already-migrated rows.
export async function setCredentialPassword(db: DbOrTx, userId: string, password: string) {
  const passwordHash = await hashPassword(password);

  const [existing] = await db
    .select({ id: baAccounts.id })
    .from(baAccounts)
    .where(and(eq(baAccounts.user_id, userId), eq(baAccounts.provider_id, "credential")))
    .limit(1);

  if (existing) {
    await db
      .update(baAccounts)
      .set({ password: passwordHash, updated_at: new Date() })
      .where(eq(baAccounts.id, existing.id));
  } else {
    await db.insert(baAccounts).values({
      id: crypto.randomUUID(),
      user_id: userId,
      provider_id: "credential",
      account_id: userId,
      password: passwordHash,
    });
  }
}
