"use client";

import { type InputHTMLAttributes, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Input } from "@/components/ui/Input";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";

export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className="pr-11" {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? t.auth.hidePassword : t.auth.showPassword}
        className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center text-muted-2 transition hover:text-ink-soft"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
