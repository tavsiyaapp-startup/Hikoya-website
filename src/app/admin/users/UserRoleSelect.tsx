"use client";

import { useTransition } from "react";
import { updateUserRole } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { UserRole } from "@/types/database";

const ROLES: UserRole[] = ["reader", "author", "moderator", "admin"];

export function UserRoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: UserRole;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();

  const labels: Record<UserRole, string> = {
    reader: t.admin.roleReader,
    author: t.admin.roleAuthor,
    moderator: t.admin.roleModerator,
    admin: t.admin.roleAdmin,
  };

  if (disabled) return <span className="text-[13.5px] text-ink-soft">{labels[role]}</span>;

  return (
    <select
      value={role}
      disabled={pending}
      onChange={(e) => startTransition(() => updateUserRole(userId, e.target.value as UserRole))}
      className="h-8.5 cursor-pointer rounded-[9px] border border-border bg-white px-2 text-[12.5px] font-bold text-ink-soft disabled:opacity-50"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {labels[r]}
        </option>
      ))}
    </select>
  );
}
