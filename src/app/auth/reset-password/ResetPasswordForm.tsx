"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { authClient } from "@/lib/auth-client";
import { ROUTES } from "@/lib/constants";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const MIN_PASSWORD_LENGTH = 6;

// Self-service "forgot password" — reached directly (no incoming link/token
// to validate, unlike the old Supabase recovery-link page this replaced).
// Same emailOTP-based flow already used by /admin-login's and
// /auth/set-password's password screens: request a code, then enter it
// with a new password. Better Auth's reset-password-with-OTP endpoint
// creates the account's first credential account if it doesn't have one
// yet, same as those two — so this also works for a Google/OTP-only
// account that never set a password.
export function ResetPasswordForm() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"email" | "otp" | "done">("email");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setPending(true);
    setError(null);
    const { error } = await authClient.emailOtp.requestPasswordReset({ email });
    setPending(false);
    if (error) {
      setError(t.profile.passwordResetError);
      return;
    }
    setStep("otp");
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t.profile.passwordTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.profile.passwordMismatch);
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await authClient.emailOtp.resetPassword({ email, otp, password });
    if (error) {
      setPending(false);
      // A wrong/expired code is by far the most common failure here — say so
      // instead of the generic "couldn't update password".
      const otpProblem = ["INVALID_OTP", "OTP_EXPIRED", "TOO_MANY_ATTEMPTS"].includes(error.code ?? "");
      setError(otpProblem ? t.auth.emailOtpError : t.profile.passwordChangeError);
      return;
    }
    // The code already proved this person owns the email, and they just
    // chose the password — sign them straight in instead of making them
    // type it again on /login. Full page load so the header/session-aware
    // server components pick up the new session cookie.
    const signIn = await authClient.signIn.email({ email, password });
    if (!signIn.error) {
      window.location.href = "/";
      return;
    }
    setPending(false);
    setStep("done");
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-3 py-6 sm:px-5">
      <div className="w-full max-w-105 overflow-hidden rounded-[20px] bezel sm:rounded-[26px]">
        <div className="px-5 pb-8 pt-7 sm:px-9 sm:pb-10 sm:pt-9">
          <div className="mb-6 text-center">
            <span className="font-script text-[25px]">{t.common.brand}</span>
          </div>

          {step === "done" ? (
            <>
              <p className="mb-6 text-center text-[14.5px] leading-relaxed text-primary-900">
                {t.profile.passwordChanged}
              </p>
              <Link prefetch={false} href={ROUTES.login}>
                <Button className="w-full justify-center">{t.common.login}</Button>
              </Link>
            </>
          ) : step === "otp" ? (
            <form onSubmit={handleConfirm} className="flex flex-col gap-4">
              <h1 className="mb-1 text-center text-[22px] font-extrabold tracking-tight sm:text-[26px]">
                {t.profile.resetPageTitle}
              </h1>
              <p className="mb-2 text-center text-[14.5px] leading-relaxed text-muted">
                {t.auth.emailSentTo} {email}. {t.auth.checkInbox}
              </p>
              {/* Password managers treat the first text field before a
                  password field as the username and auto-fill the email into
                  it — that used to be the code field. This hidden username
                  field gives them the right place, and the code field is
                  marked as a one-time code so nothing gets filled into it. */}
              <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
              <div>
                <label className="mb-1.5 block text-[13px] font-bold">{t.auth.emailOtpPlaceholder}</label>
                <Input
                  required
                  name="otp"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-bold">{t.profile.passwordLabel}</label>
                <PasswordInput
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="mt-1 text-[12px] text-muted-2">{t.profile.passwordHint}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-bold">{t.profile.passwordConfirmLabel}</label>
                <PasswordInput
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={pending} className="w-full justify-center">
                {pending ? t.common.loading : t.common.save}
              </Button>
              {error && <p className="text-center text-[12.5px] text-danger">{error}</p>}
            </form>
          ) : (
            <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
              <h1 className="mb-2 text-center text-[22px] font-extrabold tracking-tight sm:text-[26px]">
                {t.profile.resetPageTitle}
              </h1>
              <p className="mb-1 text-center text-[14.5px] leading-relaxed text-muted">
                {t.profile.resetPageBody}
              </p>
              <Input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
              <Button type="submit" disabled={pending} className="w-full justify-center">
                {pending ? t.common.loading : t.common.save}
              </Button>
              {error && <p className="text-center text-[12.5px] text-danger">{error}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
