"use client";

import { useRef, useState, useTransition } from "react";
import { setStoryCoverAdmin, removeStoryCoverAdmin } from "@/lib/actions/admin";
import { resizeImageFile } from "@/lib/image-resize";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";

// Set / replace / remove a story's cover from the admin story page.
export function StoryCoverAdmin({
  storyId,
  storySlug,
  hasCover,
}: {
  storyId: string;
  storySlug: string;
  hasCover: boolean;
}) {
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        const resized = await resizeImageFile(file, { maxWidth: 900, maxHeight: 1200 });
        const formData = new FormData();
        formData.set("file", resized, resized.name);
        const result = await setStoryCoverAdmin(storyId, storySlug, formData);
        if ("error" in result) setError(t.create.coverError);
      } catch {
        setError(t.create.coverError);
      }
    });
  }

  return (
    <div className="mt-2.5 flex flex-col items-center gap-1.5 sm:items-start">
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => inputRef.current?.click()}>
        {pending ? t.common.loading : hasCover ? t.admin.changeCover : t.admin.setCover}
      </Button>
      {hasCover && (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(t.admin.removeCoverConfirm)) return;
            startTransition(() => removeStoryCoverAdmin(storyId, storySlug));
          }}
        >
          {t.admin.removeCover}
        </Button>
      )}
      {error && <p className="max-w-40 text-[12px] text-danger">{error}</p>}
    </div>
  );
}
