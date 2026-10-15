"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendAnnouncement, type AnnouncementAudience } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { AnnouncementBody } from "@/components/notifications/AnnouncementBody";

const AUDIENCES: AnnouncementAudience[] = ["authors", "readers", "all"];

export function BroadcastForm({ counts }: { counts: Record<AnnouncementAudience, number> }) {
  const { t } = useLocale();
  const router = useRouter();
  const [text, setText] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("authors");
  const recipients = counts[audience];
  const audienceLabel: Record<AnnouncementAudience, string> = {
    authors: t.admin.broadcastToAuthors,
    readers: t.admin.broadcastToReaders,
    all: t.admin.broadcastToAll,
  };
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    const message = text.trim();
    if (!message) return;
    const confirmText = t.admin.broadcastConfirm
      .replace("{count}", String(recipients))
      .replace("{audience}", audienceLabel[audience].toLowerCase());
    if (!window.confirm(confirmText)) return;
    setResult(null);
    startTransition(async () => {
      const res = await sendAnnouncement(message, audience);
      if ("ok" in res) {
        setResult({ ok: true, text: t.admin.broadcastSent.replace("{count}", String(res.sent)) });
        // Empty form for the next one; the "Sent" list below picks this one up.
        setText("");
        router.refresh();
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
      <div>
        <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-muted-2">{t.admin.broadcastAudience}</div>
        <div className="flex flex-wrap gap-2">
          {AUDIENCES.map((a) => (
            <label key={a} className="cursor-pointer">
              <input
                type="radio"
                name="audience"
                value={a}
                checked={audience === a}
                onChange={() => setAudience(a)}
                className="peer sr-only"
              />
              <span className="flex h-10 items-center gap-2 rounded-[11px] border border-border px-3.5 text-[13.5px] font-bold text-ink-soft peer-checked:border-primary-500 peer-checked:bg-primary-50 peer-checked:text-primary-900">
                {audienceLabel[a]}
                <span className="text-[12px] font-semibold text-muted-2">{counts[a]}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        maxLength={2000}
        placeholder={t.admin.broadcastPlaceholder}
      />

      {text.trim() && (
        <div>
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-muted-2">{t.admin.broadcastPreview}</div>
          <div className="rounded-[14px] border border-border-soft bg-surface p-4.5">
            <AnnouncementBody message={text} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={send} disabled={pending || !text.trim() || recipients === 0}>
          {pending ? t.common.loading : t.admin.broadcastSend.replace("{audience}", audienceLabel[audience].toLowerCase())}
        </Button>
        <span className="text-[13px] text-muted-2">{t.admin.broadcastRecipients.replace("{count}", String(recipients))}</span>
      </div>
      {result && (
        <p className={`text-[13.5px] font-semibold ${result.ok ? "text-success" : "text-danger"}`}>{result.text}</p>
      )}
    </div>
  );
}
