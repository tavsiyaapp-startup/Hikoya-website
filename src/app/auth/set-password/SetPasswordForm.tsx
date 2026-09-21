"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { markPasswordSet } from "@/lib/actions/profile";
import { passwordErrorMessage } from "@/lib/password-error";

const MIN_PASSWORD_LENGTH = 6;

// Reached only via redirectAfterAuth, for an already-onboarded account that
// has no password yet — e.g. someone who used /login's "forgot email or
// password" fallback (Google or a magic link) instead of signing in with
// one. No skip option: this is the one and only path back to a password,
// short of going through that fallback again every time.
export function SetPasswordForm({ next, email }: { next: string; email: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
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
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setPending(false);
      setError(passwordErrorMessage(updateError.code, t, t.auth.setPasswordFailed));
      return;
    }
    await markPasswordSet();
    // Same reasoning as /auth/reset-password: once a password exists, any
    // other signed-in device is worth re-verifying rather than trusting
    // silently — sign out everywhere else, keep this session.
    await supabase.auth.signOut({ scope: "others" });
    router.push(next);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-3 py-6 sm:px-5">
      <div className="w-full max-w-105 overflow-hidden rounded-[16px] bg-card shadow-[0_30px_80px_rgba(30,20,60,0.2)] sm:rounded-[28px]">
        <div className="px-5 pb-8 pt-7 sm:px-9 sm:pb-10 sm:pt-9">
          <div className="mb-6 text-center">
            <span className="font-script text-[25px]">{t.common.brand}</span>
          </div>
          <h1 className="mb-2 text-center text-[22px] font-extrabold tracking-tight sm:text-[26px]">
            {t.auth.setPasswordTitle}
          </h1>
          <p className="mb-1 text-center text-[14.5px] leading-relaxed text-muted">
            {t.auth.setPasswordBody}
          </p>
          {email && <p className="mb-7 text-center text-[13px] font-bold text-ink-soft">{email}</p>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="mb-1.5 block text-[13px] font-bold">{t.profile.passwordLabel}</label>
              <PasswordInput
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <p className="mt-1.5 text-[12px] text-muted-2">{t.profile.passwordHint}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-bold">
                {t.profile.passwordConfirmLabel}
              </label>
              <PasswordInput
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={pending} className="mt-2 w-full justify-center">
              {pending ? t.common.loading : t.auth.setPasswordCta}
            </Button>
            {error && <p className="text-center text-[12.5px] text-danger">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
