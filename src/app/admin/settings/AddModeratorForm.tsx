"use client";

import { useState, useTransition } from "react";
import { createModerator } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function AddModeratorForm() {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formKey, setFormKey] = useState(0);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const displayName = String(formData.get("displayName") ?? "").trim();

    if (!email || !password || !displayName) {
      setError(t.admin.moderatorErrorMissingFields);
      return;
    }
    if (password.length < 6) {
      setError(t.admin.moderatorErrorShortPassword);
      return;
    }

    startTransition(async () => {
      const result = await createModerator(formData);
      if ("error" in result) {
        setError(t.admin.moderatorErrorGeneric);
        return;
      }
      setSuccess(true);
      setFormKey((k) => k + 1);
    });
  }

  return (
    <div className="rounded-[22px] border border-border bg-card p-4.5 sm:p-6.5">
      <h3 className="mb-2 text-[17px] font-extrabold">{t.admin.addModeratorTitle}</h3>
      <p className="mb-4.5 text-[13.5px] leading-relaxed text-muted">{t.admin.addModeratorBody}</p>

      <form key={formKey} action={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">{t.admin.moderatorDisplayNameLabel}</label>
          <Input name="displayName" required />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">{t.admin.moderatorEmailLabel}</label>
          <Input type="email" name="email" required />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">{t.admin.moderatorPasswordLabel}</label>
          <Input type="password" name="password" required minLength={6} />
        </div>

        {error && <p className="text-[12.5px] text-danger">{error}</p>}
        {success && <p className="text-[12.5px] text-success">{t.admin.moderatorAdded}</p>}

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? t.common.loading : t.admin.moderatorAdd}
        </Button>
      </form>
    </div>
  );
}
