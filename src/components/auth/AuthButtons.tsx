"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
}

export function GoogleButton({ next = "/", className }: { next?: string; className?: string }) {
  const { t } = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setError(t.auth.googleError);
      setPending(false);
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="ghost"
        size="lg"
        className="w-full justify-center"
        onClick={handleClick}
        disabled={pending}
      >
        Google
      </Button>
      {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}

export function EmailForm({ next = "/" }: { next?: string }) {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setPending(false);
    if (error) {
      setError(t.auth.emailError);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <p className="rounded-[13px] border border-primary-200 bg-primary-50 px-4 py-3.5 text-[14px] text-primary-900">
        {t.auth.emailSentTo} {email}. {t.auth.checkInbox}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" disabled={pending} className="shrink-0">
        {t.common.login}
      </Button>
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
    </form>
  );
}

type TelegramState = "idle" | "waiting" | "error";

// Deep-link flow instead of the Telegram Login Widget: the widget needs its
// domain whitelisted with @BotFather and never actually opens a chat with
// the bot, so there was no way to send the user a welcome message. This
// opens t.me/<bot>?start=<token>, the bot's webhook confirms the token once
// the user presses Start there (and replies with the welcome message), and
// this component polls until that happens.
export function TelegramButton({ next = "/" }: { next?: string }) {
  const { t } = useLocale();
  const [state, setState] = useState<TelegramState>("idle");
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleClick() {
    setState("waiting");
    try {
      const res = await fetch("/auth/telegram-login", { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body.token || !body.deepLink) {
        setState("error");
        return;
      }
      setDeepLink(body.deepLink);
      window.open(body.deepLink, "_blank");

      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/auth/telegram-login/${body.token}`);
          const pollBody = await pollRes.json();
          if (pollBody.status === "confirmed" && pollBody.redirect) {
            if (pollRef.current) clearInterval(pollRef.current);
            const url = new URL(pollBody.redirect, window.location.origin);
            url.searchParams.set("next", next);
            window.location.href = url.toString();
          } else if (pollBody.status === "expired" || pollBody.status === "error") {
            if (pollRef.current) clearInterval(pollRef.current);
            setState("error");
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          setState("error");
        }
      }, 2000);
    } catch {
      setState("error");
    }
  }

  if (!botUsername) {
    return (
      <div className="flex h-[50px] items-center justify-center rounded-[14px] border border-border bg-surface text-[13px] text-muted">
        {t.auth.telegramSoon}
      </div>
    );
  }

  if (state === "waiting") {
    return (
      <div className="flex h-[50px] flex-col items-center justify-center gap-0.5 rounded-[14px] border border-primary-200 bg-primary-50 px-2 text-center">
        <span className="text-[12px] font-bold text-primary-900">{t.auth.telegramWaiting}</span>
        {deepLink && (
          <a href={deepLink} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-primary-700 underline">
            {t.auth.telegramOpenAgain}
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="lg"
        className="w-full justify-center"
        onClick={handleClick}
      >
        Telegram
      </Button>
      {state === "error" && <p className="mt-2 text-[12.5px] text-danger">{t.auth.telegramError}</p>}
    </div>
  );
}
