"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { ROUTES } from "@/lib/constants";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { PageLoader } from "@/components/ui/PageLoader";

const MIN_PASSWORD_LENGTH = 6;

type Status = "checking" | "ready" | "invalid";

export function ResetPasswordForm() {
  const { t } = useLocale();
  const [status, setStatus] = useState<Status>("checking");
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();

      // The recovery link's redirect shape depends on Supabase's flow config
      // (confirmed to be a #access_token=...&type=recovery hash fragment
      // against this project, not a ?code=), so both are handled explicitly
      // here rather than relying on the SDK's automatic URL detection, which
      // errors when the browser client's own flowType (pkce, our default)
      // doesn't match the link's shape.
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      } else {
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      }
      window.history.replaceState(null, "", window.location.pathname);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setStatus("invalid");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", session.user.id)
        .single();
      setProfileUsername((profile?.username as string | undefined) ?? null);
      setStatus("ready");
    })();
  }, []);

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
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (error) {
      setError(t.profile.passwordChangeError);
      return;
    }
    setDone(true);
  }

  if (status === "checking") return <PageLoader />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-3 py-6 sm:px-5">
      <div className="w-full max-w-105 overflow-hidden rounded-[24px] bg-white shadow-[0_30px_80px_rgba(30,20,60,0.2)] sm:rounded-[28px]">
        <div className="px-5 pb-8 pt-7 sm:px-9 sm:pb-10 sm:pt-9">
          <div className="mb-6 text-center">
            <span className="font-script text-[25px]">{t.common.brand}</span>
          </div>

          {status === "invalid" ? (
            <>
              <p className="mb-6 text-center text-[14.5px] leading-relaxed text-danger">
                {t.profile.resetLinkInvalid}
              </p>
              <Link href={ROUTES.login}>
                <Button className="w-full justify-center">{t.common.login}</Button>
              </Link>
            </>
          ) : done ? (
            <>
              <p className="mb-6 text-center text-[14.5px] leading-relaxed text-primary-900">
                {t.profile.passwordChanged}
              </p>
              <Link href={profileUsername ? ROUTES.author(profileUsername) : ROUTES.home}>
                <Button className="w-full justify-center">{t.profile.backToProfile}</Button>
              </Link>
            </>
          ) : (
            <>
              <h1 className="mb-2 text-center text-[22px] font-extrabold tracking-tight sm:text-[26px]">
                {t.profile.resetPageTitle}
              </h1>
              <p className="mb-7 text-center text-[14.5px] leading-relaxed text-muted">
                {t.profile.resetPageBody}
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-[13px] font-bold">{t.profile.passwordLabel}</label>
                  <PasswordInput
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="mt-1 text-[12px] text-muted-2">{t.profile.passwordHint}</p>
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

                <Button type="submit" disabled={pending} className="w-full justify-center">
                  {pending ? t.common.loading : t.common.save}
                </Button>
                {error && <p className="text-center text-[12.5px] text-danger">{error}</p>}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
