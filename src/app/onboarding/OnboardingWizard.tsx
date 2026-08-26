"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n";
import { ROUTES } from "@/lib/constants";
import { GoogleButton, EmailForm } from "@/components/auth/AuthButtons";
import { completeOnboarding } from "./actions";

const TOTAL_STEPS = 3;

export function OnboardingWizard({ initialStep, next }: { initialStep: 1 | 2; next: string }) {
  const { t, locale } = useLocale();
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [role, setRole] = useState<"reader" | "author">("reader");
  const [interests, setInterests] = useState<string[]>([]);
  const [chosenLocale, setChosenLocale] = useState<Locale>(locale);

  useEffect(() => {
    document.cookie = `hikoya_pending_role=${role}; path=/; max-age=3600; samesite=lax`;
  }, [role]);

  function toggleInterest(genre: string) {
    setInterests((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-3 py-6 sm:px-5 sm:py-15">
      <div className="w-full max-w-[780px] overflow-hidden rounded-[24px] bg-white shadow-[0_30px_80px_rgba(30,20,60,0.2)] sm:rounded-[28px]">
        <div className="flex items-center gap-3 border-b border-border-soft px-5 py-4.5 sm:gap-4 sm:px-7.5 sm:py-5.5">
          <span className="font-script text-[25px]">{t.common.brand}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border-soft">
            <div
              className="h-full rounded-full bg-linear-to-r from-primary-700 to-primary-600 transition-all"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <span className="text-[13px] font-bold text-muted-2">
            {step} / {TOTAL_STEPS}
          </span>
        </div>

        {step === 1 && (
          <div className="px-5 pb-8 pt-6 sm:px-11.5 sm:pb-11.5 sm:pt-10">
            <h2 className="mb-2 text-[22px] font-extrabold tracking-tight sm:text-[30px]">
              {t.onboarding.welcomeTitle}
            </h2>
            <p className="mb-7 text-[15px] leading-relaxed text-muted">{t.onboarding.welcomeBody}</p>

            <div className="mb-7.5 grid grid-cols-1 gap-4 xs:grid-cols-2">
              {(
                [
                  ["reader", t.onboarding.roleReaderTitle, t.onboarding.roleReaderDesc],
                  ["author", t.onboarding.roleAuthorTitle, t.onboarding.roleAuthorDesc],
                ] as const
              ).map(([value, title, desc]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRole(value)}
                  className={clsx(
                    "flex flex-col items-start gap-1.5 rounded-2xl border p-5 text-left transition",
                    role === value
                      ? "border-primary-500 bg-primary-50"
                      : "border-border bg-white hover:bg-surface"
                  )}
                >
                  <span className="text-[17px] font-extrabold">{title}</span>
                  <span className="text-[13.5px] font-medium leading-relaxed text-muted">{desc}</span>
                </button>
              ))}
            </div>

            <div className="mb-4.5 flex items-center gap-3.5">
              <div className="h-px flex-1 bg-border-soft" />
              <span className="text-[12.5px] text-muted-3">{t.onboarding.continueVia}</span>
              <div className="h-px flex-1 bg-border-soft" />
            </div>

            <div className="mb-6.5 flex flex-col gap-3">
              <GoogleButton next={next} />
              <EmailForm next={next} />
            </div>

            <p className="text-center text-[13px] text-muted-2">
              {t.onboarding.haveAccount}{" "}
              <Link
                href={`${ROUTES.login}?next=${encodeURIComponent(next)}`}
                className="font-bold text-primary-800 hover:underline"
              >
                {t.common.login}
              </Link>
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="px-5 pb-8 pt-6 sm:px-11.5 sm:pb-11.5 sm:pt-10">
            <h2 className="mb-2 text-[22px] font-extrabold tracking-tight sm:text-[30px]">
              {t.onboarding.interestsTitle}
            </h2>
            <p className="mb-6.5 text-[15px] leading-relaxed text-muted">{t.onboarding.interestsBody}</p>

            <div className="mb-7.5 grid grid-cols-2 gap-3 xs:grid-cols-3 sm:grid-cols-5">
              {t.genres.map((genre) => {
                const active = interests.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleInterest(genre)}
                    className={clsx(
                      "flex items-center gap-2 rounded-[13px] border px-3 py-3 text-left text-[13.5px] font-bold transition",
                      active
                        ? "border-primary-500 bg-primary-50 text-primary-900"
                        : "border-border bg-white text-ink-soft hover:bg-surface"
                    )}
                  >
                    <span
                      className={clsx(
                        "h-2 w-2 shrink-0 rounded-full",
                        active ? "bg-primary-600" : "bg-border"
                      )}
                    />
                    {genre}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-13 cursor-pointer rounded-[14px] border border-border bg-white px-5.5 text-[15px] font-semibold text-ink-soft"
              >
                {t.common.back}
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="h-13 flex-1 cursor-pointer rounded-[14px] border-none bg-linear-to-br from-primary-800 to-primary-600 text-[16px] font-bold text-white shadow-[0_10px_24px_rgba(109,40,217,0.3)]"
              >
                {t.onboarding.continueCta}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form action={completeOnboarding} className="px-5 pb-8 pt-6 sm:px-11.5 sm:pb-11.5 sm:pt-10">
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="locale" value={chosenLocale} />
            {interests.map((g) => (
              <input key={g} type="hidden" name="interests" value={g} />
            ))}

            <h2 className="mb-2 text-[22px] font-extrabold tracking-tight sm:text-[30px]">{t.onboarding.langTitle}</h2>
            <p className="mb-6.5 text-[15px] leading-relaxed text-muted">{t.onboarding.langBody}</p>

            <div className="mb-6.5 grid grid-cols-2 gap-3.5">
              {(["ru", "uz"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setChosenLocale(code)}
                  className={clsx(
                    "flex flex-col items-start gap-1 rounded-[14px] border p-4 text-left transition",
                    chosenLocale === code
                      ? "border-primary-500 bg-primary-50"
                      : "border-border bg-white hover:bg-surface"
                  )}
                >
                  <span className="text-[16px] font-extrabold">{t.languages[code]}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="h-13 cursor-pointer rounded-[14px] border border-border bg-white px-5.5 text-[15px] font-semibold text-ink-soft"
              >
                {t.common.back}
              </button>
              <button
                type="submit"
                className="h-13 flex-1 cursor-pointer rounded-[14px] border-none bg-linear-to-br from-primary-800 to-primary-600 text-[16px] font-bold text-white shadow-[0_10px_24px_rgba(109,40,217,0.3)]"
              >
                {t.onboarding.startReading}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
