"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Numeric id of the bot (the public part of its token before ":"), set in
// next.config.ts. Telegram's sign-in popup is opened by id, not username.
const BOT_ID = process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID ?? "";
const WIDGET_SCRIPT = "https://telegram.org/js/telegram-widget.js?22";

type Mode = "sign-in" | "link";
type TelegramUser = Record<string, unknown>;
type TelegramGlobal = {
  Login?: {
    auth: (
      options: { bot_id: string; request_access?: "write"; lang?: string },
      callback: (user: TelegramUser | false) => void
    ) => void;
  };
};

// Loaded once per page; resolves when window.Telegram.Login is ready.
let widgetScript: Promise<void> | null = null;
function loadWidgetScript(): Promise<void> {
  if (!widgetScript) {
    widgetScript = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = WIDGET_SCRIPT;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        widgetScript = null;
        reject(new Error("telegram widget failed to load"));
      };
      document.head.appendChild(script);
    });
  }
  return widgetScript;
}

function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.94 4.3a1.2 1.2 0 0 0-1.62-1.08L2.8 10.05c-.98.38-.97 1.77.02 2.13l4.47 1.6 1.73 5.42c.25.79 1.25 1.03 1.83.44l2.5-2.53 4.43 3.27c.7.51 1.7.13 1.88-.72L21.94 4.3ZM9.6 13.6l7.72-6.03-6.2 7.24-.27 3.02-1.25-4.23Z" />
    </svg>
  );
}

// Our own button (in the site's language) that opens Telegram's sign-in
// popup through its widget script (https://core.telegram.org/widgets/login).
// Telegram's ready-made button can't be translated and its iframe showed
// black corners in dark mode. After the person confirms in Telegram the
// signed data is sent to the server (src/server/auth/telegram-plugin.ts),
// which checks the signature and signs in / links. The bot's domain must be
// set to hikoya.org in BotFather (/setdomain).
export function TelegramLoginButton({
  mode = "sign-in",
  next = "/",
  onLinked,
}: {
  mode?: Mode;
  next?: string;
  onLinked?: () => void;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!BOT_ID) return;
    let cancelled = false;
    loadWidgetScript()
      .then(() => !cancelled && setReady(true))
      .catch(() => !cancelled && setError(t.auth.telegramError));
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function submit(user: TelegramUser) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/telegram/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(user),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message === "TELEGRAM_TAKEN" ? t.auth.telegramTaken : t.auth.telegramError);
        setPending(false);
        return;
      }
      if (mode === "link") {
        setPending(false);
        onLinked?.();
        router.refresh();
        return;
      }
      // Same hand-off as Google/email: /login sends a new account through
      // onboarding, everyone else on to `next`.
      router.push(`${ROUTES.login}?next=${encodeURIComponent(next)}`);
      router.refresh();
    } catch {
      setError(t.auth.telegramError);
      setPending(false);
    }
  }

  function handleClick() {
    const login = (window as unknown as { Telegram?: TelegramGlobal }).Telegram?.Login;
    if (!login) {
      setError(t.auth.telegramError);
      return;
    }
    setError(null);
    // Opens Telegram's confirmation popup; `false` means it was closed or refused.
    login.auth({ bot_id: BOT_ID, request_access: "write", lang: locale }, (user) => {
      if (user) void submit(user);
    });
  }

  if (!BOT_ID) return null;

  return (
    <div className={mode === "link" ? "flex flex-col items-start gap-1.5" : "flex flex-col gap-1.5"}>
      <button
        type="button"
        onClick={handleClick}
        disabled={!ready || pending}
        className={`flex h-[54px] cursor-pointer items-center justify-center gap-2.5 rounded-full bg-[#54A9EB] px-6 text-[16px] font-bold text-white transition hover:brightness-105 disabled:cursor-default disabled:opacity-60 ${
          mode === "link" ? "" : "w-full"
        }`}
      >
        <TelegramIcon />
        {pending ? t.common.loading : mode === "link" ? t.auth.telegramLink : t.auth.telegramSignIn}
      </button>
      {error && <p className="text-center text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}
