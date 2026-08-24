"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { TelegramAuthData } from "@/lib/telegram";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
}

export function GoogleButton({ next = "/", className }: { next?: string; className?: string }) {
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
      setError("Не удалось связаться с сервером входа. Попробуйте ещё раз позже.");
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
      setError("Не удалось отправить ссылку для входа. Проверьте адрес и попробуйте снова.");
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <p className="rounded-[13px] border border-primary-200 bg-primary-50 px-4 py-3.5 text-[14px] text-primary-900">
        Ссылка для входа отправлена на {email}. Проверьте почту.
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
        Войти
      </Button>
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
    </form>
  );
}

declare global {
  interface Window {
    onHikoyaTelegramAuth?: (user: TelegramAuthData) => void;
  }
}

export function TelegramButton({ next = "/" }: { next?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

  useEffect(() => {
    if (!botUsername || !containerRef.current) return;

    window.onHikoyaTelegramAuth = async (user) => {
      try {
        const res = await fetch("/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });
        const body = await res.json();
        if (!res.ok || !body.redirect) {
          setError("Не удалось войти через Telegram.");
          return;
        }
        const url = new URL(body.redirect);
        url.searchParams.set("next", next);
        window.location.href = url.toString();
      } catch {
        setError("Не удалось войти через Telegram.");
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "14");
    script.setAttribute("data-onauth", "onHikoyaTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    containerRef.current.appendChild(script);

    return () => {
      window.onHikoyaTelegramAuth = undefined;
    };
  }, [botUsername, next]);

  if (!botUsername) {
    return (
      <div className="flex h-[50px] items-center justify-center rounded-[14px] border border-border bg-surface text-[13px] text-muted">
        Telegram скоро
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className="flex h-[50px] items-center justify-center" />
      {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
    </>
  );
}
