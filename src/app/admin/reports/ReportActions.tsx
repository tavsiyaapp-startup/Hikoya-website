"use client";

import { useTransition } from "react";
import { resolveCommentReport } from "@/lib/actions/reports";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";

export function ReportActions({ reportId, canHide, canBlock }: { reportId: string; canHide: boolean; canBlock: boolean }) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();

  function run(action: "dismiss" | "hide" | "block") {
    if (action === "block" && !window.confirm(t.admin.reportBlockConfirm)) return;
    startTransition(async () => {
      const result = await resolveCommentReport(reportId, action).catch(() => ({ error: "failed" as const }));
      if ("error" in result) window.alert(t.admin.actionRefused);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("dismiss")}>
        {t.admin.reportDismiss}
      </Button>
      {canHide && (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run("hide")}>
          {t.admin.reportHide}
        </Button>
      )}
      {canBlock && (
        <Button size="sm" variant="danger" disabled={pending} onClick={() => run("block")}>
          {t.admin.reportBlock}
        </Button>
      )}
    </div>
  );
}
