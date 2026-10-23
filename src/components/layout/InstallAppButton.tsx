"use client";

import { useState, useSyncExternalStore } from "react";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { CloseIcon } from "@/components/ui/icons";

// «Ilovani oʻrnatish» — install Hikoya as an app (PWA, see app/manifest.ts).
//  - Android/Chrome & co.: the browser hands us an install prompt
//    (beforeinstallprompt); the button shows it.
//  - iPhone/iPad: Safari never offers a prompt, so the button opens a
//    three-step "Share → Add to Home Screen" guide.
//  - Already installed (opened from the home screen) or a browser with
//    neither: no button.

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// The prompt event can fire before any button is on screen, so it is kept
// at module level (one per page load) and every button reads it.
let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function isIos() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

type Mode = "hidden" | "prompt" | "ios";

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function currentMode(): Mode {
  if (isStandalone()) return "hidden";
  if (deferred) return "prompt";
  return isIos() ? "ios" : "hidden";
}

function PhoneIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6" y="2.5" width="12" height="19" rx="3" />
      <path d="M12 7.5v7M9 12l3 3 3-3" />
    </svg>
  );
}

export function InstallAppButton({
  variant,
  className,
  style,
  onDone,
}: {
  variant: "footer" | "menu";
  className?: string;
  style?: React.CSSProperties;
  onDone?: () => void;
}) {
  const { t } = useLocale();
  // Server render and first paint: no button (the server can't know).
  const mode = useSyncExternalStore(subscribe, currentMode, () => "hidden" as Mode);
  const [guide, setGuide] = useState(false);
  const [inSafari, setInSafari] = useState(true);

  if (mode === "hidden") return null;

  async function install() {
    if (mode === "ios") {
      setInSafari(!/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/.test(navigator.userAgent));
      setGuide(true);
      return;
    }
    const ev = deferred;
    if (!ev) return;
    await ev.prompt();
    await ev.userChoice.catch(() => null);
    deferred = null;
    listeners.forEach((l) => l());
    onDone?.();
  }

  const steps = [
    {
      text: t.pwa.iosStep1,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3v12M8 7l4-4 4 4" />
          <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
        </svg>
      ),
    },
    {
      text: t.pwa.iosStep2,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
          <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
          <path d="M12 8.5v7M8.5 12h7" />
        </svg>
      ),
    },
    { text: t.pwa.iosStep3, icon: <span className="font-display text-[15px] font-bold">✓</span> },
  ];

  return (
    <>
      <button
        type="button"
        onClick={install}
        style={style}
        className={clsx(
          "flex cursor-pointer items-center gap-2 font-semibold transition",
          variant === "footer" &&
            "h-9 rounded-full border border-border bg-card px-3.5 text-[13px] text-ink-soft hover:border-primary-200 hover:text-ink",
          className
        )}
      >
        <PhoneIcon />
        <span>{t.pwa.install}</span>
      </button>

      {guide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-label={t.pwa.iosTitle}>
          <button type="button" aria-label={t.common.close} onClick={() => setGuide(false)} className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[2px]" />
          <div className="relative w-full max-w-sm rounded-t-[26px] bg-card p-6 sm:rounded-[26px]" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[20px] font-bold">{t.pwa.iosTitle}</h2>
              <button type="button" onClick={() => setGuide(false)} aria-label={t.common.close} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full hover:bg-surface">
                <CloseIcon />
              </button>
            </div>
            {!inSafari && (
              <p className="mb-4 rounded-[12px] bg-amber-100 px-3.5 py-2.5 text-[13px] font-semibold text-amber-800 dark:bg-[#3D2F14] dark:text-amber-300">
                {t.pwa.iosSafariOnly}
              </p>
            )}
            <ol className="flex flex-col gap-3.5">
              {steps.map((step, i) => (
                <li key={i} className="flex items-center gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-primary-50 text-primary-800">{step.icon}</span>
                  <span className="text-[14.5px] leading-snug text-ink-soft">{step.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
