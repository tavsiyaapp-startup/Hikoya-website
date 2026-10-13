"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";

type Mode = "sign-in" | "link";
type TelegramCallback = (user: Record<string, unknown>) => void;

// Telegram's own Login Widget (https://core.telegram.org/widgets/login): a
// script from telegram.org draws the button; after the person confirms in
// Telegram it calls back here with their signed data, which is sent to the
// server (src/server/auth/telegram-plugin.ts) to check the signature and
// sign in / link. The bot's domain must be set to hikoya.org in BotFather
// (/setdomain), otherwise Telegram shows "Bot domain invalid".
export function TelegramLoginButton({
  mode = "sign-in",
  next = "/",
  onLinked,
}: {
  mode?: Mode;
  next?: string;
  onLinked?: () => void;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackName = `hikoyaTelegram_${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!BOT_USERNAME || !container) return;
    const globals = window as unknown as Record<string, TelegramCallback | undefined>;

    globals[callbackName] = async (user) => {
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
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", `${callbackName}(user)`);
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
      delete globals[callbackName];
    };
  }, [callbackName, mode, next, onLinked, router, t]);

  if (!BOT_USERNAME) return null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div ref={containerRef} className={pending ? "pointer-events-none opacity-50" : undefined} />
      {pending && <p className="text-[12.5px] text-muted-2">{t.common.loading}</p>}
      {error && <p className="text-center text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}
