"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
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
