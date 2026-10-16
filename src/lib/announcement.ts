// A staff announcement can carry its own button (link + label). There's no
// column for it — it travels in notifications.message as one hidden last
// line, "[[button:<url>|<label>]]", which the site never shows as text.

export interface AnnouncementButton {
  url: string;
  label: string;
}

const MARKER = /\n*\[\[button:([^\s|\]]+)\|([^\]\n]*)\]\]\s*$/;
const MAX_LABEL = 40;

// The link the button opens, or null when it isn't one we allow: https/http
// URLs, a page of this site ("/collections"), or a Telegram @handle.
export function normalizeButtonUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value)) return `https://t.me/${value.slice(1)}`;
  if (value.startsWith("/") && !value.startsWith("//") && !/[\s\\]/.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function isTelegramUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(t|telegram)\.me\//.test(url);
}

export function encodeAnnouncement(text: string, button: AnnouncementButton | null): string {
  const body = text.trim();
  if (!button) return body;
  const label = button.label.replace(/[\]\n|]/g, " ").trim().slice(0, MAX_LABEL);
  const url = button.url.replace(/\|/g, "%7C").replace(/\]/g, "%5D");
  return `${body}\n[[button:${url}|${label}]]`;
}

export function decodeAnnouncement(message: string): { text: string; button: AnnouncementButton | null } {
  const m = message.match(MARKER);
  if (!m) return { text: message, button: null };
  const url = normalizeButtonUrl(m[1]);
  return { text: message.slice(0, m.index).trimEnd(), button: url ? { url, label: m[2].trim() } : null };
}
