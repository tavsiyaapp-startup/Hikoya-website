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

// Every wall-clock display in the app is pinned to Tashkent time regardless
// of where the server/viewer actually is — otherwise a serverless function
// running in UTC (or a viewer's own browser in another timezone) shows
// times shifted from what our audience expects.
const TIMEZONE = "Asia/Tashkent";

export function formatDateTime(dateStr: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  }).format(new Date(dateStr));
}

export function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(locale, { timeZone: TIMEZONE });
}

export function formatTimestamp(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleString(locale, { timeZone: TIMEZONE });
}

export function formatRelativeTime(dateStr: string, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  let diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  for (const [amount, unit] of RELATIVE_UNITS) {
    if (Math.abs(diff) < amount || amount === Infinity) return rtf.format(-Math.round(diff), unit);
    diff /= amount;
  }
  return rtf.format(-Math.round(diff), "year");
}
