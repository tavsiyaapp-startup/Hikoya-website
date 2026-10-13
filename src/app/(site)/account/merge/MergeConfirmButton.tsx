"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";

export function MergeConfirmButton({ token }: { token: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/telegram/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        // This browser is now signed in to the kept account.
        router.push(`${ROUTES.login}?next=${encodeURIComponent(ROUTES.home)}`);
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message === "target_has_telegram" ? t.merge.targetHasTelegram : t.merge.failed);
    } catch {
      setError(t.merge.failed);
    }
    setPending(false);
  }

  return (
    <div>
      <Button onClick={confirm} disabled={pending}>
        {pending ? t.common.loading : t.merge.confirm}
      </Button>
      {error && <p className="mt-3 text-[13px] font-semibold text-danger">{error}</p>}
    </div>
  );
}
