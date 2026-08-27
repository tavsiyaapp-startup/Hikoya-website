"use client";

import { clsx } from "clsx";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative h-7 w-12 cursor-pointer rounded-full border-none transition",
        checked ? "bg-linear-to-br from-primary-800 to-primary-600" : "bg-[#E2DCF0] dark:bg-[#332B4E]"
      )}
    >
      <span
        className={clsx(
          "absolute left-0 top-0.5 h-6 w-6 rounded-full bg-card shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
