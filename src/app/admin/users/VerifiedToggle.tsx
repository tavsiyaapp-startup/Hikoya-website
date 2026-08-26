"use client";

import { useTransition } from "react";
import { toggleUserVerified } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Toggle } from "@/components/ui/Toggle";

export function VerifiedToggle({ userId, verified }: { userId: string; verified: boolean }) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <Toggle
      checked={verified}
      onChange={(next) => !pending && startTransition(() => toggleUserVerified(userId, next))}
      label={t.admin.colVerified}
    />
  );
}
