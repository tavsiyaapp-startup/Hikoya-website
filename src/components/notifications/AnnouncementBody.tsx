"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { decodeAnnouncement, isTelegramUrl } from "@/lib/announcement";

// Text of a staff announcement (notifications.message), shown in the
// notifications list and in the one-time popup. Line breaks are kept,
// links and Telegram @handles become clickable, and when the text names a
// Telegram account (@name or t.me/name) a Telegram button to it is added
// below — no separate link field is stored.
// The lookbehind keeps an email address (name@gmail.com) from turning into a
// Telegram link.
const TOKEN = /(https?:\/\/[^\s]+|(?<![\w.])@[A-Za-z][A-Za-z0-9_]{4,31})/g;

function telegramUrl(token: string): string | null {
  if (token.startsWith("@")) return `https://t.me/${token.slice(1)}`;
  const m = token.match(/^https?:\/\/(?:www\.)?(?:t|telegram)\.me\/([A-Za-z0-9_]{5,32})/);
  return m ? `https://t.me/${m[1]}` : null;
}

function TelegramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.94 4.3a1.2 1.2 0 0 0-1.62-1.08L2.8 10.05c-.98.38-.97 1.77.02 2.13l4.47 1.6 1.73 5.42c.25.79 1.25 1.03 1.83.44l2.5-2.53 4.43 3.27c.7.51 1.7.13 1.88-.72L21.94 4.3ZM9.6 13.6l7.72-6.03-6.2 7.24-.27 3.02-1.25-4.23Z" />
    </svg>
  );
}

export function AnnouncementBody({ message, onLinkClick }: { message: string; onLinkClick?: () => void }) {
  const { t } = useLocale();
  const { text, button: ownButton } = decodeAnnouncement(message);
  const parts = text.split(TOKEN);
  // A button set in the broadcast form wins; otherwise the first Telegram
  // @handle / t.me link in the text gets one.
  const autoTelegram = (text.match(TOKEN) ?? []).map(telegramUrl).find(Boolean) ?? null;
  const button = ownButton
    ? {
        url: ownButton.url,
        label: ownButton.label || (isTelegramUrl(ownButton.url) ? t.notifications.openTelegram : t.notifications.openLink),
        telegram: isTelegramUrl(ownButton.url),
      }
    : autoTelegram
      ? { url: autoTelegram, label: t.notifications.openTelegram, telegram: true }
      : null;

  return (
    <div>
      <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink-soft">
        {parts.map((part, i) => {
          if (i % 2 === 0) return part;
          const href = telegramUrl(part) ?? (part.startsWith("http") ? part : null);
          if (!href) return part;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onLinkClick}
              className="font-bold text-primary-800 underline-offset-2 hover:underline"
            >
              {part}
            </a>
          );
        })}
      </p>
      {button && (
        <a
          href={button.url}
          target={button.url.startsWith("/") ? undefined : "_blank"}
          rel={button.url.startsWith("/") ? undefined : "noopener noreferrer"}
          onClick={onLinkClick}
          className={`mt-3.5 inline-flex h-11 items-center gap-2 rounded-[13px] px-5 text-[14.5px] font-bold text-white transition hover:brightness-105 ${
            button.telegram ? "bg-[#54A9EB]" : "bg-accent hover:bg-accent-hover"
          }`}
        >
          {button.telegram && <TelegramIcon />}
          {button.label}
        </a>
      )}
    </div>
  );
}
