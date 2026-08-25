import { type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Chip({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border px-3.5 text-[13px] font-semibold transition",
        active
          ? "border-primary-300 bg-primary-50 text-primary-900"
          : "border-border bg-white text-ink-soft hover:bg-surface",
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "primary" | "success" | "danger" | "pink" | "warning";
}) {
  const toneClasses: Record<string, string> = {
    neutral: "bg-[#F4F2FA] text-[#5B5479]",
    primary: "bg-primary-100 text-primary-800",
    success: "bg-success-bg text-success",
    danger: "bg-danger-bg text-danger",
    pink: "bg-pink-bg text-pink",
    warning: "bg-amber-100 text-amber-800",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[12.5px] font-bold",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
