"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ROUTES } from "@/lib/constants";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";

// /login routes a signed-in user on: unfinished onboarding -> onboarding
// (display name, avatar, password), no password yet -> set-password,
// otherwise -> next.
function afterSignIn(next: string): string {
  return `${ROUTES.login}?next=${encodeURIComponent(next)}`;
}

// Google's own four-colour "G" — the mark people look for on this button.
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function GoogleButton({ next = "/", className }: { next?: string; className?: string }) {
  const { t } = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: afterSignIn(next) });
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
        <GoogleMark />
        <span>{pending ? t.common.loading : t.auth.loginWithGoogle}</span>
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
  const [notice, setNotice] = useState<string | null>(null);

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
    setNotice(null);
    const { error } = await authClient.signIn.emailOtp({ email, otp });
    setPending(false);
    if (error) {
      setError((error.status ?? 0) >= 500 ? t.auth.serverError : t.auth.emailOtpError);
      return;
    }
    router.push(afterSignIn(next));
    router.refresh();
  }

  async function handleResendOtp() {
    setPending(true);
    setError(null);
    setNotice(null);
    setOtp("");
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setPending(false);
    if (error) setError(t.auth.emailError);
    else setNotice(t.auth.emailOtpResent);
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
            name="otp"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            placeholder={t.auth.emailOtpPlaceholder}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
          <Button type="submit" disabled={pending} className="shrink-0">
            {pending ? t.common.loading : t.auth.emailOtpSubmit}
          </Button>
        </div>
        {error && <p className="text-[12.5px] text-danger">{error}</p>}
        {notice && <p className="text-[12.5px] text-success">{notice}</p>}
        <button
          type="button"
          onClick={handleResendOtp}
          disabled={pending}
          className="self-start cursor-pointer text-[12.5px] font-bold text-primary-800 hover:underline disabled:opacity-50"
        >
          {t.auth.emailOtpResend}
        </button>
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
