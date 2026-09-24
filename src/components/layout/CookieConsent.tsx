"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/Button";

const STORAGE_KEY = "hikoya_cookie_consent";

// Informational notice, not a hard consent gate — doesn't block Analytics
// or any cookie from being set before it's accepted (see the Cookie Policy
// this links to for what's actually set: auth session, locale/theme,
// guest-read tracking, Google Analytics). Mounted once in the root layout
// so it's visible on every page, including auth/admin.
export function CookieConsent() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Deliberately not a useState lazy initializer: localStorage doesn't
    // exist during SSR, so seeding the initial state from it there would
    // make the very first client render disagree with the server-rendered
    // HTML (hydration mismatch) — reading it post-mount, once, is correct.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Storage unavailable (private mode, disabled cookies) — just skip it
      // rather than block the page on a broken check.
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      // Nothing we can do — it'll just ask again next visit.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-5">
      <div className="w-full max-w-[400px] overflow-hidden rounded-[20px] bg-card p-6 text-center shadow-[0_30px_80px_rgba(30,20,60,0.25)] sm:p-7">
        <div className="relative mx-auto mb-3 h-20 w-20">
          <Image src="/images/cookie.png" alt="" fill sizes="80px" className="object-contain" />
        </div>
        <h2 className="mb-2 text-[17px] font-extrabold">{t.cookieConsent.title}</h2>
        <p className="mb-5 text-[13.5px] leading-relaxed text-muted-2">
          {t.cookieConsent.body}{" "}
          <Link href={ROUTES.cookies} className="font-semibold text-primary-800 underline underline-offset-2">
            {t.cookieConsent.learnMore}
          </Link>
        </p>
        <Button onClick={accept} className="w-full justify-center">
          {t.cookieConsent.accept}
        </Button>
      </div>
    </div>
  );
}
