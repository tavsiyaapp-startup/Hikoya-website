"use client";

import { useState, useTransition } from "react";
import { sendAuthorAnnouncement } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { AnnouncementBody } from "@/components/notifications/AnnouncementBody";

export function BroadcastForm({ recipients, defaultText }: { recipients: number; defaultText: string }) {
  const { t } = useLocale();
  const [text, setText] = useState(defaultText);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    const message = text.trim();
    if (!message) return;
    if (!window.confirm(t.admin.broadcastConfirm.replace("{count}", String(recipients)))) return;
    setResult(null);
    startTransition(async () => {
      const res = await sendAuthorAnnouncement(message);
      if ("ok" in res) {
        setResult({ ok: true, text: t.admin.broadcastSent.replace("{count}", String(res.sent)) });
        return;
      }
      setResult({
        ok: false,
        text:
          res.error === "too_long"
            ? t.admin.broadcastTooLong
            : res.error === "no_recipients"
              ? t.admin.broadcastNoRecipients
              : t.admin.broadcastFailed,
      });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={2000} />

      <div>
        <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-muted-2">{t.admin.broadcastPreview}</div>
        <div className="rounded-[14px] border border-border-soft bg-surface p-4.5">
          <AnnouncementBody message={text} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={send} disabled={pending || !text.trim() || recipients === 0}>
          {pending ? t.common.loading : t.admin.broadcastSend}
        </Button>
        <span className="text-[13px] text-muted-2">{t.admin.broadcastRecipients.replace("{count}", String(recipients))}</span>
      </div>
      {result && (
        <p className={`text-[13.5px] font-semibold ${result.ok ? "text-success" : "text-danger"}`}>{result.text}</p>
      )}
    </div>
  );
}
