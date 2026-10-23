// Bank card helpers for «Donat» (DonateButton, DonationSettings, and the
// server side in src/server/data/donations.ts).

export const LOCAL_CARD_TYPES = ["uzcard", "humo"] as const;
export const INTL_CARD_TYPES = ["visa", "mastercard"] as const;
export type LocalCardType = (typeof LOCAL_CARD_TYPES)[number];
export type IntlCardType = (typeof INTL_CARD_TYPES)[number];
export type CardType = LocalCardType | IntlCardType;

export const CARD_TYPE_LABEL: Record<CardType, string> = {
  uzcard: "Uzcard",
  humo: "Humo",
  visa: "Visa",
  mastercard: "Mastercard",
};

// "8600123412341234" → "8600 1234 1234 1234"
export function formatCardNumber(digits: string): string {
  return digits.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
}

// Only a hint while typing: the author picks the card type themselves
// (co-badged cards, new prefixes), this just pre-selects the likely one.
export function guessCardType(digits: string): CardType | null {
  if (digits.startsWith("8600") || digits.startsWith("5614")) return "uzcard";
  if (digits.startsWith("9860")) return "humo";
  if (digits.startsWith("4")) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  return null;
}
