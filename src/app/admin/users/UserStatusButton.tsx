"use client";

import { useTransition } from "react";
import { toggleUserStatus } from "@/lib/actions/admin";

export function UserStatusButton({ userId, status }: { userId: string; status: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleUserStatus(userId, status))}
      className="h-8.5 cursor-pointer rounded-[9px] border border-border bg-white px-3.5 text-[12.5px] font-bold text-ink-soft disabled:opacity-50"
    >
      {status === "active" ? "Заблокировать" : "Разблокировать"}
    </button>
  );
}
