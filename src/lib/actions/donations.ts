"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { loadViewer } from "@/server/data/viewer";
import { canEditOwnProfile } from "@/server/authz/policy";
import { takeRateLimit } from "@/server/rate-limit";
import { eq } from "drizzle-orm";
import { profiles } from "@/server/db/schema";
import { DonationInputError, getDonation, hasPublishedStory, saveDonation } from "@/server/data/donations";
import { CARD_TYPE_LABEL } from "@/lib/card";
import { notifyDonationReported } from "@/lib/telegram";
import { ROUTES } from "@/lib/constants";

export type SaveDonationResult =
  | { ok: true; enabled: boolean }
  | { ok: false; error: "card" | "intlCard" | "cardType" | "holder" | "message" | "forbidden" | "rate" | "failed" };

// Saves the author's «Donat» settings (src/components/profile/DonationSettings.tsx).
// Only an active account with at least one published story may have them.
export async function saveDonationSettings(username: string, formData: FormData): Promise<SaveDonationResult> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "forbidden" };
  if (!takeRateLimit(`donation:${session.user.id}`, 20, 60 * 60 * 1000)) return { ok: false, error: "rate" };

  try {
    const db = getDb();
    const viewer = await loadViewer(db, session.user.id);
    if (!viewer || !canEditOwnProfile(viewer, session.user.id)) return { ok: false, error: "forbidden" };
    if (!(await hasPublishedStory(db, session.user.id))) return { ok: false, error: "forbidden" };

    const saved = await saveDonation(db, session.user.id, {
      cardNumber: String(formData.get("cardNumber") ?? ""),
      cardType: String(formData.get("cardType") ?? ""),
      intlCardNumber: String(formData.get("intlCardNumber") ?? ""),
      intlCardType: String(formData.get("intlCardType") ?? ""),
      cardHolder: String(formData.get("cardHolder") ?? ""),
      message: String(formData.get("message") ?? ""),
    });
    revalidatePath(ROUTES.author(username));
    return { ok: true, enabled: saved !== null };
  } catch (err) {
    if (err instanceof DonationInputError) return { ok: false, error: err.code };
    console.error("[donations] save failed", err);
    return { ok: false, error: "failed" };
  }
}

const AMOUNT_MAX = 40;

// A reader tells us how much they sent an author (the field under the card
// in the donate popup). Nothing is stored — it goes straight to the team's
// Telegram chat (src/lib/telegram.ts), only to see whether authors earn
// through Hikoya. Guests may send it too; limited per visitor.
export async function reportDonation(
  authorId: string,
  card: "local" | "intl",
  rawAmount: string
): Promise<{ ok: boolean; error?: "amount" | "rate" | "failed" }> {
  const amount = rawAmount.replace(/\s+/g, " ").trim();
  if (!amount || amount.length > AMOUNT_MAX || !/\d/.test(amount)) return { ok: false, error: "amount" };

  const h = await headers();
  const session = await getAuth().api.getSession({ headers: h }).catch(() => null);
  const visitor = session?.user.id ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!takeRateLimit(`donation-report:${visitor}`, 10, 60 * 60 * 1000)) return { ok: false, error: "rate" };

  try {
    const db = getDb();
    const [author] = await db
      .select({ display_name: profiles.display_name, username: profiles.username })
      .from(profiles)
      .where(eq(profiles.id, authorId))
      .limit(1);
    const donation = author ? await getDonation(db, authorId) : null;
    const target = donation?.[card];
    if (!author || !target) return { ok: false, error: "failed" };

    let fromUsername: string | null = null;
    if (session) {
      const [me] = await db.select({ username: profiles.username }).from(profiles).where(eq(profiles.id, session.user.id)).limit(1);
      fromUsername = me?.username ?? null;
    }

    await notifyDonationReported({
      authorName: author.display_name,
      authorUsername: author.username,
      amount,
      cardType: CARD_TYPE_LABEL[target.type],
      fromUsername,
    });
    return { ok: true };
  } catch (err) {
    console.error("[donations] report failed", err);
    return { ok: false, error: "failed" };
  }
}
