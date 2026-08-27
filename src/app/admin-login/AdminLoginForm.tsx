"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
}

export function AdminLoginForm({ next }: { next?: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(t.admin.loginError);
      setPending(false);
      return;
    }
    router.push(destination);
    router.refresh();
  }

  // For a freshly-promoted moderator whose account never had a password
  // (registered via Google, or the site's magic-link flow) — signInWithPassword
  // has nothing to check against for them. Same resetPasswordForEmail flow the
  // regular profile's "change password" button uses; lands them on
  // /auth/reset-password to actually set one, then they come back here.
  async function handleForgotPassword() {
    if (!email) {
      setResetError(t.admin.loginResetNeedsEmail);
      return;
    }
    setResetPending(true);
    setResetError(null);
    setResetMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl()}${ROUTES.resetPassword}`,
    });
    setResetPending(false);
    if (error) setResetError(t.admin.loginResetError);
    else setResetMessage(t.admin.loginResetSent);
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

      <button
        type="button"
        onClick={handleForgotPassword}
        disabled={resetPending}
        className="cursor-pointer text-center text-[12.5px] font-bold text-primary-800 hover:underline"
      >
        {resetPending ? t.common.loading : t.admin.loginForgotPassword}
      </button>
      {resetMessage && <p className="text-[12.5px] text-success">{resetMessage}</p>}
      {resetError && <p className="text-[12.5px] text-danger">{resetError}</p>}
    </form>
  );
}
