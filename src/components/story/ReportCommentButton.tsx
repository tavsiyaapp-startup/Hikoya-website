"use client";

import { useState, useTransition } from "react";
import { reportComment } from "@/lib/actions/reports";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";

const REASONS = ["spam", "abuse", "spoiler", "other"] as const;

// "Пожаловаться" under a comment: pick a reason, optionally add a note, send.
// Shown only to signed-in readers on someone else's comment (the server
// re-checks both — see lib/actions/reports.ts).
type ReportResult = { ok: true } | { error: string };

// `send` lets Muhokamalar reuse the same form for topics and their comments
// (lib/actions/forum.ts); by default it reports a story comment.
export function ReportCommentButton({
  commentId,
  send,
}: {
  commentId: string;
  send?: (reason: string, details: string) => Promise<ReportResult>;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("spam");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [errorText, setErrorText] = useState("");
  const [pending, startTransition] = useTransition();

  const reasonLabels: Record<(typeof REASONS)[number], string> = {
    spam: t.reader.reportReasonSpam,
    abuse: t.reader.reportReasonAbuse,
    spoiler: t.reader.reportReasonSpoiler,
    other: t.reader.reportReasonOther,
  };

  if (status === "sent") {
    return <span className="text-[12.5px] font-semibold text-muted-3">{t.reader.reportSent}</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer text-[13px] font-bold text-muted-3 hover:text-danger"
      >
        {t.reader.report}
      </button>
    );
  }

  function submit() {
    setStatus("idle");
    startTransition(async () => {
      const result: ReportResult = await (send ? send(reason, details) : reportComment(commentId, reason, details)).catch(() => ({ error: "failed" }));
      if ("ok" in result) {
        setStatus("sent");
        return;
      }
      setErrorText(
        result.error === "rate_limited"
          ? t.reader.reportRateLimited
          : result.error === "unauthorized"
            ? t.reader.reportSignIn
            : result.error === "not_allowed"
              ? t.reader.reportNotAllowed
              : t.reader.reportError
      );
      setStatus("error");
    });
  }

  return (
    <div className="mt-2 w-full rounded-[10px] border border-border bg-surface p-3.5">
      <div className="mb-2 text-[13px] font-bold">{t.reader.reportTitle}</div>
      <div className="mb-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {REASONS.map((r) => (
          <label key={r} className="flex cursor-pointer items-center gap-1.5 text-[13px]">
            <input type="radio" name={`report-${commentId}`} checked={reason === r} onChange={() => setReason(r)} />
            {reasonLabels[r]}
          </label>
        ))}
      </div>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder={t.reader.reportDetailsPlaceholder}
        className="mb-2.5 w-full rounded-[8px] border border-border bg-card px-3 py-2 text-[13px]"
      />
      {status === "error" && <p className="mb-2 text-[12.5px] text-danger">{errorText}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending}>
          {pending ? t.common.loading : t.reader.reportSubmit}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          {t.common.cancel}
        </Button>
      </div>
    </div>
  );
}
