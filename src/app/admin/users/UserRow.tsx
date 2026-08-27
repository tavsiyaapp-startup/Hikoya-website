"use client";

import { useState, useTransition } from "react";
import { updateUserAchievements } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Badge } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { UserRoleSelect } from "./UserRoleSelect";
import { UserStatusButton } from "./UserStatusButton";
import { VerifiedToggle } from "./VerifiedToggle";
import type { Achievement, Profile, UserRole } from "@/types/database";
import type { Locale } from "@/lib/i18n";

export function UserRow({
  user,
  viewerIsAdmin,
  locale,
  achievements,
  initialCheckedIds,
}: {
  user: Profile;
  viewerIsAdmin: boolean;
  locale: Locale;
  achievements: Achievement[];
  initialCheckedIds: string[];
}) {
  const { t } = useLocale();
  const [badgesOpen, setBadgesOpen] = useState(false);
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
    startTransition(async () => {
      await updateUserAchievements(user.id, [...checked]);
      setBadgesOpen(false);
    });
  }

  return (
    <div className="border-b border-border-soft py-3.5 last:border-0">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-[1.4]">
          <div className="text-[14px] font-bold">{user.display_name}</div>
          <div className="text-[12.5px] text-muted-2">@{user.username}</div>
        </div>
        <span className="w-27.5">
          <UserRoleSelect userId={user.id} role={user.role as UserRole} disabled={!viewerIsAdmin} />
        </span>
        <span className="w-22.5 text-[13.5px] text-ink-soft">—</span>
        <span className="w-32.5 text-[13.5px] text-muted-2">
          {new Date(user.created_at).toLocaleDateString(locale)}
        </span>
        <span className="w-30">
          <Badge tone={user.status === "active" ? "success" : "danger"}>{user.status}</Badge>
        </span>
        <span className="w-24 shrink-0">
          <VerifiedToggle userId={user.id} verified={user.is_verified} />
        </span>
        <span className="w-32 shrink-0">
          <button
            type="button"
            onClick={() => setBadgesOpen((v) => !v)}
            className="h-8.5 cursor-pointer rounded-[9px] border border-border bg-card px-3.5 text-[12.5px] font-bold text-ink-soft"
          >
            {t.admin.manageBadges} ({initialCheckedIds.length})
          </button>
        </span>
        <span className="w-30 shrink-0 text-right">
          <UserStatusButton userId={user.id} status={user.status} />
        </span>
      </div>

      {badgesOpen && (
        <div className="mt-3 rounded-2xl border border-border bg-surface p-4">
          {achievements.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {achievements.map((a) => (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-1.5 text-[13px] font-semibold text-ink-soft hover:bg-primary-50"
                >
                  <input
                    type="checkbox"
                    checked={checked.has(a.id)}
                    onChange={() => toggle(a.id)}
                    className="h-4 w-4"
                  />
                  {locale === "uz" ? a.title_uz : a.title_ru}
                </label>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-[13px] text-muted-2">{t.admin.noBadgesAvailable}</p>
          )}
          <Button type="button" size="sm" disabled={pending} onClick={handleSave}>
            {pending ? t.common.loading : t.admin.saveBadges}
          </Button>
        </div>
      )}
    </div>
  );
}
