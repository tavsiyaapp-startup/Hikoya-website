"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// The site's own support bot (the same one «Obuna» payments use).
const BOT_USERNAME = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "").replace(/^@/, "");
const POLL_MS = 2000;
const GIVE_UP_MS = 10 * 60 * 1000;

type Mode = "sign-in" | "link";
type PollStatus = "pending" | "ok" | "cancelled" | "expired";

function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.94 4.3a1.2 1.2 0 0 0-1.62-1.08L2.8 10.05c-.98.38-.97 1.77.02 2.13l4.47 1.6 1.73 5.42c.25.79 1.25 1.03 1.83.44l2.5-2.53 4.43 3.27c.7.51 1.7.13 1.88-.72L21.94 4.3ZM9.6 13.6l7.72-6.03-6.2 7.24-.27 3.02-1.25-4.23Z" />
    </svg>
  );
}

function randomString(bytes: number): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Sign-in (or linking, from profile settings) through the site's bot — flow
// in src/server/auth/telegram-bot-login.ts. The click opens
// t.me/<bot>?start=login_<token>; the person presses Start and «Ha, kirish»
// in Telegram while this page asks the server every 2 s whether it's done,
// then carries on like after any sign-in. No phone number, no popup — works
// in in-app browsers and in the installed app, since the page that waits is
// the one that gets signed in.
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
  const [link, setLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<{ token: string; secret: string; started: number } | null>(null);

  useEffect(() => {
    if (!link) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function stop(message: string | null) {
      stopped = true;
      attempt.current = null;
      setLink(null);
      setError(message);
    }

    async function poll() {
      const current = attempt.current;
      if (stopped || !current) return;
      if (Date.now() - current.started > GIVE_UP_MS) return stop(t.auth.telegramExpired);
      try {
        const res = await fetch("/api/auth/telegram/bot-poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ token: current.token, secret: current.secret }),
        });
        if (stopped) return;
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          return stop(body?.message === "TELEGRAM_TAKEN" ? t.auth.telegramTaken : t.auth.telegramError);
        }
        const { status } = (await res.json()) as { status: PollStatus };
        if (status === "ok") {
          stopped = true;
          attempt.current = null;
          if (mode === "link") {
            setLink(null);
            onLinked?.();
            router.refresh();
            return;
          }
          setPending(true);
          // Same hand-off as Google/email: /login sends a new account through
          // onboarding, everyone else on to `next`.
          router.push(`${ROUTES.login}?next=${encodeURIComponent(next)}`);
          router.refresh();
          return;
        }
        if (status === "cancelled") return stop(t.auth.telegramCancelled);
        if (status === "expired") return stop(t.auth.telegramExpired);
      } catch {
        // A dropped connection (phone switching to Telegram) — just ask again.
      }
      timer = setTimeout(poll, POLL_MS);
    }

    // Coming back from Telegram: ask straight away instead of waiting.
    function onVisible() {
      if (document.visibilityState !== "visible" || stopped) return;
      clearTimeout(timer);
      void poll();
    }

    timer = setTimeout(poll, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [link, mode, next, onLinked, router, t]);

  function handleClick() {
    const token = randomString(24);
    const secret = randomString(32);
    const url = `https://t.me/${BOT_USERNAME}?start=login_${token}`;
    attempt.current = { token, secret, started: Date.now() };
    setError(null);
    // Opened straight from the click — browsers block a window opened later.
    window.open(url, "_blank", "noopener");
    setLink(url);
    fetch("/api/auth/telegram/bot-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ token, secret, mode }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
      })
      .catch(() => {
        if (attempt.current?.token !== token) return;
        attempt.current = null;
        setLink(null);
        setError(t.auth.telegramError);
      });
  }

  if (!BOT_USERNAME) return null;

  return (
    <div className={mode === "link" ? "flex flex-col items-start gap-1.5" : "flex flex-col gap-1.5"}>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={`flex h-[54px] cursor-pointer items-center justify-center gap-2.5 rounded-full bg-[#54A9EB] px-6 text-[16px] font-bold text-white transition hover:brightness-105 disabled:cursor-default disabled:opacity-60 ${
          mode === "link" ? "" : "w-full"
        }`}
      >
        <TelegramIcon />
        {pending ? t.common.loading : mode === "link" ? t.auth.telegramLink : t.auth.telegramSignIn}
      </button>
      {link && (
        <div role="status" className="text-center text-[12.5px] leading-relaxed text-muted">
          <p>{mode === "link" ? t.auth.telegramWaitingLink : t.auth.telegramWaiting}</p>
          <a href={link} target="_blank" rel="noopener noreferrer" className="font-bold text-primary-800 hover:underline">
            {t.auth.telegramOpenAgain}
          </a>
        </div>
      )}
      {error && <p className="text-center text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}
