// Word after a number. Dictionary values hold the Russian forms as
// "one|few|many" (1 отклик, 2 отклика, 5 откликов); a value without "|"
// (Uzbek doesn't inflect after numbers) is returned as is.
export function plural(n: number, forms: string): string {
  const parts = forms.split("|");
  if (parts.length < 3) return parts[0];
  const abs = Math.abs(Math.trunc(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return parts[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return parts[1];
  return parts[2];
}
