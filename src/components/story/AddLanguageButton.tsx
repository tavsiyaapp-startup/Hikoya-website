"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// stories.language is free text now (not limited to ru/uz) — this lets an
// author type a language that isn't Russian or Uzbek. Same trigger-then-
// input shape as AddGenreButton.
export function AddLanguageButton({ onAdd }: { onAdd: (language: string) => void }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setValue("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function commit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 cursor-pointer rounded-[10px] border border-dashed border-primary-300 bg-card px-3.5 text-[13px] font-semibold text-primary-800"
      >
        {t.create.addLanguage}
      </button>
    );
  }

  return (
    <div ref={ref} className="flex items-center gap-1.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
        className="flex items-center gap-1.5"
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t.create.languageInputPlaceholder}
          className="h-9 w-40 rounded-[10px] border border-border px-2.5 text-[13px] outline-none"
        />
        <button
          type="submit"
          className="h-9 shrink-0 cursor-pointer rounded-[10px] bg-primary-800 px-3.5 text-[13px] font-bold text-white"
        >
          {t.create.addLanguageConfirm}
        </button>
      </form>
    </div>
  );
}
