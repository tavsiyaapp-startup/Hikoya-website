"use client";

import { useRef, useState, useTransition } from "react";
import { addChapter } from "@/lib/actions/stories";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

export function AddChapterForm({ storyId, storySlug }: { storyId: string; storySlug: string }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="md">
        {t.manage.addChapter}
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          await addChapter(storyId, storySlug, formData);
          formRef.current?.reset();
          setOpen(false);
        })
      }
      className="mb-6 rounded-2xl border border-border bg-card p-5.5"
    >
      <Input name="title" placeholder={t.create.chapterTitlePlaceholder} className="mb-3.5" required />
      <Textarea name="content" placeholder={t.create.chapterTextPlaceholder} rows={8} required />
      <div className="mt-3.5 flex gap-2.5">
        <Button type="submit" disabled={pending}>
          {pending ? t.common.loading : t.common.save}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}
