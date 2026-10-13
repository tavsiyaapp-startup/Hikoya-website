"use client";

import { useState, useTransition } from "react";
import { transferStoriesAdmin } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

// Admin only (the page renders it for admins, the action re-checks): moves
// all of this account's works to another account the same person uses.
export function TransferStoriesPanel({ userId, displayName }: { userId: string; displayName: string }) {
  const { t } = useLocale();
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const query = target.trim();
    if (!query) return;
    if (!window.confirm(t.admin.transferConfirm.replace("{from}", displayName).replace("{to}", query))) return;
    setMessage(null);
    startTransition(async () => {
      const result = await transferStoriesAdmin(userId, query);
      if ("ok" in result) {
        setTarget("");
        setMessage({
          ok: true,
          text: t.admin.transferDone.replace("{count}", String(result.moved)).replace("{to}", result.targetUsername),
        });
        return;
      }
      setMessage({
        ok: false,
        text:
          result.error === "same_user"
            ? t.admin.transferSameUser
            : result.error === "no_stories"
              ? t.admin.transferNoStories
              : t.admin.transferNotFound,
      });
    });
  }

  return (
    <div className="mb-6 rounded-[14px] border border-border bg-card px-4.5 py-5 sm:px-6.5 sm:py-6">
      <h3 className="mb-1.5 text-[17px] font-extrabold">{t.admin.transferTitle}</h3>
      <p className="mb-4 text-[13px] leading-relaxed text-muted-2">{t.admin.transferBody}</p>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={t.admin.transferPlaceholder}
          className="flex-1"
        />
        <Button type="button" variant="danger" disabled={pending || !target.trim()} onClick={submit} className="shrink-0">
          {pending ? t.common.loading : t.admin.transferButton}
        </Button>
      </div>
      {message && (
        <p className={`mt-3 text-[13px] font-semibold ${message.ok ? "text-success" : "text-danger"}`}>{message.text}</p>
      )}
    </div>
  );
}
