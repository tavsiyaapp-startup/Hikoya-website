"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";

export function GoogleButton({ next = "/", className }: { next?: string; className?: string }) {
  const { t } = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: next });
    if (error) {
      setError(t.auth.googleError);
      setPending(false);
    }
    // On success Better Auth redirects the browser itself — nothing left to do here.
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

// Passwordless fallback, same spirit as the old Supabase magic link but
// code-based — reuses the emailOTP plugin already wired in
// src/server/auth/config.ts (the same one the admin forgot-password flow
// uses) rather than configuring a second, link-based flow for what's
// explicitly a secondary login path. A code that doesn't match any
// existing account just creates one on verification, same as the old
// magic link's implicit sign-up — there's no separate "already
// registered" pre-check (mode is kept only for copy, not branching logic).
export function EmailForm({ next = "/" }: { next?: string; mode?: "login" | "register" }) {
  const { t } = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setPending(true);
    setError(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setPending(false);
    if (error) {
      setError(t.auth.emailError);
      return;
    }
    setStep("otp");
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp) return;
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.emailOtp({ email, otp });
    setPending(false);
    if (error) {
      setError(t.auth.emailOtpError);
      return;
    }
    router.push(next);
    router.refresh();
  }

  if (step === "otp") {
    return (
      <form onSubmit={handleVerifyOtp} className="flex flex-col gap-2">
        <p className="text-[13px] text-ink-muted">
          {t.auth.emailSentTo} {email}. {t.auth.checkInbox}
        </p>
        <div className="flex gap-2">
          <Input
            required
            placeholder={t.auth.emailOtpPlaceholder}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            autoFocus
          />
          <Button type="submit" disabled={pending} className="shrink-0">
            {pending ? t.common.loading : t.auth.emailOtpSubmit}
          </Button>
        </div>
        {error && <p className="text-[12.5px] text-danger">{error}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={handleSendOtp} className="flex gap-2">
      <Input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" disabled={pending} className="shrink-0">
        {pending ? t.common.loading : t.common.login}
      </Button>
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
    </form>
  );
}

// Registration screen's "continue with email" option — starts as a button
// so Google stays visually primary, and reveals the same EmailForm used on
// /login once clicked.
export function EmailLoginToggle({
  next = "/",
  mode = "login",
  className,
}: {
  next?: string;
  mode?: "login" | "register";
  className?: string;
}) {
  const { t } = useLocale();
  const [show, setShow] = useState(false);

  if (show) return <EmailForm next={next} mode={mode} />;

  return (
    <div className={className}>
      <Button
        type="button"
        variant="ghost"
        size="lg"
        className="w-full justify-center"
        onClick={() => setShow(true)}
      >
        {t.auth.loginWithEmail}
      </Button>
    </div>
  );
}

// Signing in with a password only ever applies to accounts that already set
// one from their profile (or during onboarding) — signIn.email just fails
// for everyone else, same as a wrong password, so no separate "this
// account has no password" state is needed.
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
    const { error } = await authClient.signIn.email({ email, password });
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
