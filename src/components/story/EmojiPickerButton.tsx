"use client";

import { useEffect, useRef, useState } from "react";

const EMOJIS = [
  "😀", "😂", "🥰", "😍", "😊", "🙂", "😉", "😢", "😭", "😡",
  "👍", "👎", "👏", "🙏", "🔥", "❤️", "💔", "✨", "🎉", "😱",
  "😴", "🤔", "😅", "😎", "🥺", "😏", "😳", "🤗", "😤", "💯",
  "🤣", "😇", "🙄", "😬", "🥳", "😮", "🤯", "🫶", "👀", "💜",
];

export function EmojiPickerButton({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Emoji"
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-border bg-card text-[17px] transition hover:bg-surface"
      >
        🙂
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-20 mb-2 grid w-64 grid-cols-8 gap-1 rounded-2xl border border-border bg-card p-2 shadow-[0_14px_30px_rgba(60,40,120,0.14)]">
          {EMOJIS.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              type="button"
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[18px] transition hover:bg-surface"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
