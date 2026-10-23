// Bank card display helpers for «Donat» (DonateButton, DonationSettings).

// "8600123412341234" → "8600 1234 1234 1234"
export function formatCardNumber(digits: string): string {
  return digits.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
}

// Card system by number prefix, shown as a small label next to the number.
export function cardBrand(digits: string): string | null {
  if (digits.startsWith("8600") || digits.startsWith("5614")) return "Uzcard";
  if (digits.startsWith("9860")) return "Humo";
  if (digits.startsWith("4")) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  return null;
}
