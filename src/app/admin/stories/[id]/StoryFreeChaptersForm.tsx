"use client";

import { useState, useTransition } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { setStoryFreeChaptersAction } from "@/lib/actions/paywall";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

// «Obuna»: how many chapters of this story are free (for stories whose
// action only starts in chapter 3–4). Empty = the site-wide setting.
export function StoryFreeChaptersForm({ storyId, current, fallback }: { storyId: string; current: number | null; fallback: number }) {
  const { t } = useLocale();
  const [value, setValue] = useState(current === null ? "" : String(current));
  const [status, setStatus] = useState<"saved" | "error" | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setStatus(null);
        startTransition(async () => setStatus((await setStoryFreeChaptersAction(storyId, value)) ? "saved" : "error"));
      }}
      className="mt-4.5 max-w-160 rounded-[14px] border border-border-soft bg-surface p-4"
    >
      <label className="mb-1.5 block text-[13px] font-bold">{t.paywall.adminStoryFree}</label>
      <div className="flex flex-wrap items-center gap-2.5">
        <Input
          type="number"
          min={0}
          max={1000}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={String(fallback)}
          className="!w-28"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {t.common.save}
        </Button>
        {status === "saved" && <span className="text-[12.5px] font-bold text-success">{t.paywall.adminSaved}</span>}
        {status === "error" && <span className="text-[12.5px] text-danger">{t.common.error}</span>}
      </div>
      <p className="mt-1.5 text-[12px] text-muted-2">{t.paywall.adminStoryFreeHint.replace("{n}", String(fallback))}</p>
    </form>
  );
}
