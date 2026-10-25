import { type InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={clsx(
          "h-[50px] w-full rounded-[14px] border border-border bg-surface px-4 text-[15px] text-ink outline-none transition placeholder:text-muted-3 focus:border-primary-400 focus:bg-card focus:ring-4 focus:ring-primary-400/20",
          className
        )}
        {...props}
      />
    );
  }
);
