import "server-only";
import { and, count, eq, isNull } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/client";
import { authorDonations, stories } from "@/server/db/schema";
import { INTL_CARD_TYPES, LOCAL_CARD_TYPES, guessCardType, type IntlCardType, type LocalCardType } from "@/lib/card";

// «Donat»: an author's card details, shown to readers in a popup on the
// author page. Hikoya never touches the money — the reader copies the card
// number and sends the transfer in their own bank app.
//
// Two optional cards: a local one (Uzcard / Humo) for readers in
// Uzbekistan and an international one (Visa / Mastercard) for readers
// abroad. At least one must be filled in for the button to appear.

export const DONATION_LIMITS = { holder: 60, message: 300 } as const;

export type Donation = {
  local: { number: string; type: LocalCardType } | null;
  intl: { number: string; type: IntlCardType } | null;
  cardHolder: string | null;
  message: string | null;
};

export class DonationInputError extends Error {
  constructor(readonly code: "card" | "intlCard" | "cardType" | "localCard" | "holder" | "message") {
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

function asLocal(t: string | null): LocalCardType | null {
  return LOCAL_CARD_TYPES.find((x) => x === t) ?? null;
}

function asIntl(t: string | null): IntlCardType | null {
  return INTL_CARD_TYPES.find((x) => x === t) ?? null;
}

export async function getDonation(db: DbOrTx, authorId: string): Promise<Donation | null> {
  const [row] = await db.select().from(authorDonations).where(eq(authorDonations.author_id, authorId)).limit(1);
  if (!row) return null;
  const localType = asLocal(row.card_type);
  const intlType = asIntl(row.intl_card_type);
  const donation: Donation = {
    local: row.card_number && localType ? { number: row.card_number, type: localType } : null,
    intl: row.intl_card_number && intlType ? { number: row.intl_card_number, type: intlType } : null,
    cardHolder: row.card_holder,
    message: row.message,
  };
  return donation.local || donation.intl ? donation : null;
}

// Both card numbers empty turns donations off (the row is removed).
export async function saveDonation(
  db: DbOrTx,
  authorId: string,
  input: { cardNumber: string; cardType: string; intlCardNumber: string; intlCardType: string; cardHolder: string; message: string }
): Promise<Donation | null> {
  const cardNumber = normalizeCardNumber(input.cardNumber);
  const intlCardNumber = normalizeCardNumber(input.intlCardNumber);
  const cardHolder = input.cardHolder.trim().replace(/\s+/g, " ");
  const message = input.message.trim();

  if (!cardNumber && !intlCardNumber) {
    await db.delete(authorDonations).where(eq(authorDonations.author_id, authorId));
    return null;
  }
  if (cardNumber && !isValidCardNumber(cardNumber)) throw new DonationInputError("card");
  if (intlCardNumber && !isValidCardNumber(intlCardNumber)) throw new DonationInputError("intlCard");
  // Uzcard / Humo is told by the number itself (8600… / 9860…).
  const localType = cardNumber ? asLocal(guessCardType(cardNumber)) : null;
  const intlType = intlCardNumber ? asIntl(input.intlCardType) : null;
  if (cardNumber && !localType) throw new DonationInputError("localCard");
  if (intlCardNumber && !intlType) throw new DonationInputError("cardType");
  if (cardHolder.length > DONATION_LIMITS.holder) throw new DonationInputError("holder");
  if (message.length > DONATION_LIMITS.message) throw new DonationInputError("message");

  const values = {
    card_number: cardNumber || null,
    card_type: localType,
    intl_card_number: intlCardNumber || null,
    intl_card_type: intlType,
    card_holder: cardHolder || null,
    message: message || null,
  };
  await db
    .insert(authorDonations)
    .values({ author_id: authorId, ...values })
    .onConflictDoUpdate({ target: authorDonations.author_id, set: { ...values, updated_at: new Date() } });
  return {
    local: cardNumber && localType ? { number: cardNumber, type: localType } : null,
    intl: intlCardNumber && intlType ? { number: intlCardNumber, type: intlType } : null,
    cardHolder: values.card_holder,
    message: values.message,
  };
}
