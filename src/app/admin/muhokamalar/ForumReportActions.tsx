"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveForumReportAction } from "@/lib/actions/forum";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";

// Same three decisions as for story-comment complaints (../reports).
export function ForumReportActions({ reportId, canHide, canBlock }: { reportId: string; canHide: boolean; canBlock: boolean }) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: "dismiss" | "hide" | "block") {
    if (action === "block" && !window.confirm(t.admin.reportBlockConfirm)) return;
    startTransition(async () => {
      const result = await resolveForumReportAction(reportId, action).catch(() => ({ error: "failed" as const }));
      if ("error" in result) window.alert(result.error === "already_resolved" ? t.admin.reportAlreadyResolved : t.admin.actionRefused);
      router.refresh();
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
