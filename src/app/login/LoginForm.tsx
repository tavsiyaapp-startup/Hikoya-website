"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";
import { GoogleButton, EmailForm, PasswordLoginForm } from "@/components/auth/AuthButtons";

export function LoginForm({ next, initialByPassword = false }: { next: string; initialByPassword?: boolean }) {
  const { t } = useLocale();
  const [byPassword, setByPassword] = useState(initialByPassword);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-3 py-6 sm:px-5">
      <div className="w-full max-w-105 overflow-hidden rounded-[24px] bg-card shadow-[0_30px_80px_rgba(30,20,60,0.2)] sm:rounded-[28px]">
        <div className="px-5 pb-8 pt-7 sm:px-9 sm:pb-10 sm:pt-9">
          <div className="mb-6 text-center">
            <span className="font-script text-[25px]">{t.common.brand}</span>
          </div>
          <h1 className="mb-2 text-center text-[22px] font-extrabold tracking-tight sm:text-[26px]">
            {t.auth.loginPageTitle}
          </h1>
          <p className="mb-7 text-center text-[14.5px] leading-relaxed text-muted">
            {t.auth.loginPageBody}
          </p>

          <div className="mb-3 flex flex-col gap-3">
            <GoogleButton next={next} />
            {byPassword ? <PasswordLoginForm next={next} /> : <EmailForm next={next} />}
          </div>

          <p className="mb-5 text-center text-[12.5px]">
            <button
              type="button"
              onClick={() => setByPassword((v) => !v)}
              className="cursor-pointer font-bold text-primary-800 hover:underline"
            >
              {byPassword ? t.auth.magicLinkToggle : t.auth.passwordLoginToggle}
            </button>
          </p>

          <p className="mb-5 text-center text-[12.5px] leading-relaxed text-muted-2">
            {t.auth.telegramRemovedNotice}
          </p>

          <p className="text-center text-[13px] text-muted-2">
            {t.auth.noAccount}{" "}
            <Link
              href={`${ROUTES.onboarding}?next=${encodeURIComponent(next)}`}
              className="font-bold text-primary-800 hover:underline"
            >
              {t.common.register}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
