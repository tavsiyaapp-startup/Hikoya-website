"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { loadViewer } from "@/server/data/viewer";
import { canEditOwnProfile } from "@/server/authz/policy";
import { takeRateLimit } from "@/server/rate-limit";
import { DonationInputError, hasPublishedStory, saveDonation } from "@/server/data/donations";
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
