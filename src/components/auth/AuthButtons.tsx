"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";

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

// mode="register" (onboarding) additionally checks email_is_registered
// before sending anything — an already-registered email trying to "sign
// up" gets steered to /login instead of a fresh magic link under a
// misleading "you're registering" banner. mode="login" (the /login page)
// skips that check entirely: there, "already registered" is the whole
// point, not something to warn about.
export function EmailForm({ next = "/", mode = "login" }: { next?: string; mode?: "login" | "register" }) {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setPending(true);
    setError(null);
    const supabase = createClient();

    if (mode === "register") {
      const { data: exists } = await supabase.rpc("email_is_registered", { check_email: email });
      if (exists) {
        setPending(false);
        setAlreadyRegistered(true);
        return;
      }
    }

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

  if (alreadyRegistered) {
    return (
      <div className="rounded-[13px] border border-primary-200 bg-primary-50 px-4 py-3.5">
        <p className="mb-2 text-[14px] text-primary-900">{t.auth.emailAlreadyRegistered}</p>
        <Link
          href={`${ROUTES.login}?mode=password&next=${encodeURIComponent(next)}`}
          className="text-[13px] font-bold text-primary-800 hover:underline"
        >
          {t.auth.goToLoginWithPassword}
        </Link>
      </div>
    );
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

// Signing in with a password only ever applies to accounts that already set
// one from their profile (or during onboarding) — signInWithPassword just
// fails for everyone else, same as a wrong password, so no separate
// "this account has no password" state is needed.
export function PasswordLoginForm({ next = "/" }: { next?: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(t.auth.passwordLoginError);
      setPending(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      <Input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <PasswordInput
        required
        placeholder={t.auth.passwordPlaceholder}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" disabled={pending} className="w-full justify-center">
        {pending ? t.common.loading : t.common.login}
      </Button>
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
    </form>
  );
}
