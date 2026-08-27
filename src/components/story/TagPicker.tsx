"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function TagPicker({
  existingTags,
  onAdd,
}: {
  existingTags: string[];
  onAdd: (tag: string) => void;
}) {
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

  function commit(tag: string) {
    const trimmed = tag.trim();
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
        {t.create.addTag}
      </button>
    );
  }

  const trimmedValue = value.trim();
  const suggestions = (
    trimmedValue
      ? existingTags.filter((tag) => tag.toLowerCase().includes(trimmedValue.toLowerCase()))
      : existingTags
  ).slice(0, 8);
  const isNewTag = trimmedValue && !existingTags.some((tag) => tag.toLowerCase() === trimmedValue.toLowerCase());

  return (
    <div ref={ref} className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commit(value);
        }}
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t.create.tagSearchPlaceholder}
          className="h-9 rounded-[10px] border border-border px-2.5 text-[13px] outline-none"
        />
      </form>
      {(suggestions.length > 0 || isNewTag) && (
        <div className="absolute left-0 top-full z-20 mt-1.5 max-h-52 w-56 overflow-y-auto rounded-[12px] border border-border bg-card p-1.5 shadow-[0_14px_30px_rgba(60,40,120,0.14)]">
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => commit(tag)}
              className="block w-full cursor-pointer truncate rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-surface"
            >
              {tag}
            </button>
          ))}
          {isNewTag && (
            <button
              type="button"
              onClick={() => commit(value)}
              className="block w-full cursor-pointer truncate rounded-lg px-2.5 py-2 text-left text-[13px] font-bold text-primary-800 hover:bg-surface"
            >
              {t.create.addNewTag.replace("{tag}", trimmedValue)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
