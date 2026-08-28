"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { HelpIcon, CloseIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";

const SEEN_KEY = "hikoya_docx_import_tour_seen";

// Shown automatically the first time an author opens this page (localStorage
// flag, per-browser — good enough, there's nothing to reconcile server-side
// for a one-off tutorial), and replayable any time via the small label next
// to the page title.
export function ImportGuide() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Deliberately not a useState lazy initializer: localStorage doesn't
    // exist during SSR, so seeding the initial state from it there would
    // make the very first client render disagree with the server-rendered
    // HTML (hydration mismatch) — reading it post-mount, once, is correct.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      // Storage unavailable (private mode, blocked) — just skip the
      // auto-open rather than crash; the replay button still works fine.
    }
  }, []);

  const steps = [
    { title: t.manage.importTourStep1Title, body: t.manage.importTourStep1Body },
    { title: t.manage.importTourStep2Title, body: t.manage.importTourStep2Body },
    { title: t.manage.importTourStep3Title, body: t.manage.importTourStep3Body },
    { title: t.manage.importTourStep4Title, body: t.manage.importTourStep4Body },
  ];
  const isLast = step === steps.length - 1;

  function close() {
    setOpen(false);
    setStep(0);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Nothing to persist to — the tutorial will just auto-open again next
      // time, which is harmless.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStep(0);
          setOpen(true);
        }}
        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5 text-[12.5px] font-bold text-primary-800 transition hover:bg-surface"
      >
        <HelpIcon width={15} height={15} />
        {t.manage.importTourLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-105 rounded-3xl border border-border bg-card p-6 shadow-[0_30px_80px_rgba(30,20,60,0.25)]"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[12.5px] font-bold text-muted-2">
                {step + 1} / {steps.length}
              </span>
              <button
                type="button"
                onClick={close}
                aria-label={t.common.close}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-ink-soft transition hover:bg-surface"
              >
                <CloseIcon width={16} height={16} />
              </button>
            </div>

            <div className="mb-5 flex gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={clsx("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary-600" : "bg-border-soft")}
                />
              ))}
            </div>

            <h3 className="mb-2 text-[18px] font-extrabold tracking-tight">{steps[step].title}</h3>
            <p className="mb-6 text-[14px] leading-relaxed text-ink-soft">{steps[step].body}</p>

            <div className="flex gap-3">
              {!isLast && (
                <Button type="button" variant="ghost" className="flex-1" onClick={close}>
                  {t.manage.importTourSkip}
                </Button>
              )}
              <Button
                type="button"
                className="flex-1"
                onClick={() => (isLast ? close() : setStep((s) => s + 1))}
              >
                {isLast ? t.common.close : t.common.next}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
