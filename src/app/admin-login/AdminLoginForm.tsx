"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function AdminLoginForm({ next }: { next?: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot-password is a 2-step OTP flow (request code, then enter code +
  // new password) via the emailOTP plugin already wired in
  // src/server/auth/config.ts — Better Auth's own email-link reset flow
  // isn't configured, and this stays a 2-step inline form rather than a
  // separate page for this one narrow case ("a freshly-promoted moderator
  // whose account never had a password").
  const [resetStep, setResetStep] = useState<"idle" | "otp-sent">("idle");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetPending, setResetPending] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // Only ever follow an internal /admin destination — next comes from a URL
  // query param, so treat it as untrusted input rather than a safe redirect.
  const destination = next && next.startsWith("/admin") ? next : "/admin";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      setError(t.admin.loginError);
      setPending(false);
      return;
    }
    router.push(destination);
    router.refresh();
  }

  async function handleRequestReset() {
    if (!email) {
      setResetError(t.admin.loginResetNeedsEmail);
      return;
    }
    setResetPending(true);
    setResetError(null);
    setResetMessage(null);
    const { error } = await authClient.emailOtp.requestPasswordReset({ email });
    setResetPending(false);
    if (error) {
      setResetError(t.admin.loginResetError);
      return;
    }
    setResetStep("otp-sent");
    setResetMessage(t.admin.loginResetSent);
  }

  async function handleConfirmReset() {
    setResetPending(true);
    setResetError(null);
    const { error } = await authClient.emailOtp.resetPassword({ email, otp, password: newPassword });
    setResetPending(false);
    if (error) {
      setResetError(t.admin.loginResetError);
      return;
    }
    setResetStep("idle");
    setOtp("");
    setNewPassword("");
    setResetMessage(t.admin.loginPasswordChanged);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-90 flex-col gap-3">
      <Input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
      />
      <Input
        type="password"
        required
        placeholder={t.admin.loginPasswordPlaceholder}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" size="lg" disabled={pending} className="w-full justify-center">
        {pending ? t.common.loading : t.common.login}
      </Button>
      {error && <p className="text-[12.5px] text-danger">{error}</p>}

      {resetStep === "idle" ? (
        <button
          type="button"
          onClick={handleRequestReset}
          disabled={resetPending}
          className="cursor-pointer text-center text-[12.5px] font-bold text-primary-800 hover:underline"
        >
          {resetPending ? t.common.loading : t.admin.loginForgotPassword}
        </button>
      ) : (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <Input
            required
            placeholder={t.admin.loginOtpPlaceholder}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <Input
            type="password"
            required
            placeholder={t.admin.loginNewPasswordPlaceholder}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Button
            type="button"
            onClick={handleConfirmReset}
            disabled={resetPending}
            className="w-full justify-center"
          >
            {resetPending ? t.common.loading : t.admin.loginResetConfirm}
          </Button>
        </div>
      )}
      {resetMessage && <p className="text-[12.5px] text-success">{resetMessage}</p>}
      {resetError && <p className="text-[12.5px] text-danger">{resetError}</p>}
    </form>
  );
}
