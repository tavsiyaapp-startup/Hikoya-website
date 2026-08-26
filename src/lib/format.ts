export function formatCompactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

const RELATIVE_UNITS: [number, Intl.RelativeTimeFormatUnit][] = [
  [60, "second"],
  [60, "minute"],
  [24, "hour"],
  [30, "day"],
  [12, "month"],
  [Infinity, "year"],
];

export function formatRelativeTime(dateStr: string, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  let diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  for (const [amount, unit] of RELATIVE_UNITS) {
    if (Math.abs(diff) < amount || amount === Infinity) return rtf.format(-Math.round(diff), unit);
    diff /= amount;
  }
  return rtf.format(-Math.round(diff), "year");
}
