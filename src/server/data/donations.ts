import "server-only";
import { and, count, eq, isNull } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/client";
import { authorDonations, stories } from "@/server/db/schema";

// «Donat»: an author's card details, shown to readers in a popup on the
// author page. Hikoya never touches the money — the reader copies the card
// number and sends the transfer in their own bank app.

export const DONATION_LIMITS = { holder: 60, message: 300 } as const;

export type Donation = { cardNumber: string; cardHolder: string | null; message: string | null };

export class DonationInputError extends Error {
  constructor(readonly code: "card" | "holder" | "message") {
    super(code);
  }
}

// Spaces, dashes and dots people type between digit groups are dropped.
export function normalizeCardNumber(raw: string): string {
  return raw.replace(/[\s\-.]/g, "");
}

export function isValidCardNumber(digits: string): boolean {
  return /^\d{16}$/.test(digits);
}

// The settings appear only once an author has at least one published story.
export async function hasPublishedStory(db: DbOrTx, authorId: string): Promise<boolean> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(stories)
    .where(and(eq(stories.author_id, authorId), eq(stories.status, "published"), isNull(stories.deleted_at)));
  return total > 0;
}

export async function getDonation(db: DbOrTx, authorId: string): Promise<Donation | null> {
  const [row] = await db
    .select({ cardNumber: authorDonations.card_number, cardHolder: authorDonations.card_holder, message: authorDonations.message })
    .from(authorDonations)
    .where(eq(authorDonations.author_id, authorId))
    .limit(1);
  return row ?? null;
}

// An empty card number turns donations off (the row is removed).
export async function saveDonation(
  db: DbOrTx,
  authorId: string,
  input: { cardNumber: string; cardHolder: string; message: string }
): Promise<Donation | null> {
  const cardNumber = normalizeCardNumber(input.cardNumber);
  const cardHolder = input.cardHolder.trim().replace(/\s+/g, " ");
  const message = input.message.trim();

  if (!cardNumber) {
    await db.delete(authorDonations).where(eq(authorDonations.author_id, authorId));
    return null;
  }
  if (!isValidCardNumber(cardNumber)) throw new DonationInputError("card");
  if (cardHolder.length > DONATION_LIMITS.holder) throw new DonationInputError("holder");
  if (message.length > DONATION_LIMITS.message) throw new DonationInputError("message");

  const values = { cardNumber, cardHolder: cardHolder || null, message: message || null };
  await db
    .insert(authorDonations)
    .values({ author_id: authorId, card_number: values.cardNumber, card_holder: values.cardHolder, message: values.message })
    .onConflictDoUpdate({
      target: authorDonations.author_id,
      set: { card_number: values.cardNumber, card_holder: values.cardHolder, message: values.message, updated_at: new Date() },
    });
  return values;
}
