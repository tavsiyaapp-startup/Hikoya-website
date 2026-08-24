import { type TextareaHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={clsx(
        "w-full resize-y rounded-[13px] border border-border bg-surface px-4 py-3.5 text-[15px] leading-relaxed text-ink outline-none transition focus:border-primary-500 focus:bg-white",
        className
      )}
      {...props}
    />
  );
});
