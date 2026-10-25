import { type ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "border-none bg-accent text-on-accent shadow-[0_10px_24px_-12px_rgba(85,53,166,0.6)] hover:-translate-y-px hover:bg-accent-hover hover:shadow-[0_14px_28px_-12px_rgba(85,53,166,0.65)]",
  secondary:
    "border border-primary-200 bg-card text-primary-900 hover:border-primary-300 hover:bg-primary-50",
  ghost: "border border-border bg-card text-ink-soft hover:border-primary-200 hover:bg-surface",
  danger:
    "border border-red-200 dark:border-red-900/60 bg-card text-danger hover:bg-danger-bg",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-4 text-[13.5px] rounded-full gap-1.5",
  md: "h-[46px] px-6 text-[14.5px] rounded-full gap-2",
  lg: "h-[54px] px-7 text-[16px] rounded-full gap-2.5",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(function Button({ variant = "primary", size = "md", className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={clsx(
        "inline-flex cursor-pointer items-center justify-center font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
});
