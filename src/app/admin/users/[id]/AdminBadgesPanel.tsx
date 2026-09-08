"use client";

import { useState, useTransition } from "react";
import { updateUserAchievements } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import type { Achievement } from "@/types/database";
import type { Locale } from "@/lib/i18n";

export function AdminBadgesPanel({
  userId,
  achievements,
  initialCheckedIds,
  locale,
}: {
  userId: string;
  achievements: Achievement[];
  initialCheckedIds: string[];
  locale: Locale;
}) {
  const { t } = useLocale();
  const [checked, setChecked] = useState(new Set(initialCheckedIds));
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    startTransition(() => updateUserAchievements(userId, [...checked]));
  }

  return (
    <div className="mb-6 rounded-[20px] border border-border bg-card px-6.5 py-6">
      <h3 className="mb-4.5 text-[17px] font-extrabold">{t.admin.manageBadges}</h3>
      {achievements.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {achievements.map((a) => (
            <label
              key={a.id}
              className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink-soft hover:bg-primary-50"
            >
              <input type="checkbox" checked={checked.has(a.id)} onChange={() => toggle(a.id)} className="h-4 w-4" />
              {locale === "uz" ? a.title_uz : a.title_ru}
            </label>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-[13px] text-muted-2">{t.admin.noBadgesAvailable}</p>
      )}
      <Button type="button" size="sm" disabled={pending} onClick={handleSave}>
        {pending ? t.common.loading : t.admin.saveBadges}
      </Button>
    </div>
  );
}
