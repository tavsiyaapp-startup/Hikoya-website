import { type InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={clsx(
          "h-[50px] w-full rounded-[13px] border border-border bg-surface px-4 text-[15px] text-ink outline-none transition focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(167,139,250,0.16)]",
          className
        )}
        {...props}
      />
    );
  }
);
