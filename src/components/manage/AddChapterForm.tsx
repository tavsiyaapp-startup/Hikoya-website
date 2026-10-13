"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addChapter } from "@/lib/actions/stories";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Input } from "@/components/ui/Input";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Button } from "@/components/ui/Button";

export function AddChapterForm({ storyId, storySlug }: { storyId: string; storySlug: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
      // onSubmit rather than action={...}: React resets a form after its
      // action runs, which would wipe the title even when the save failed.
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          setError(null);
          const saved = await addChapter(storyId, storySlug, formData).catch(() => false);
          if (!saved) {
            setError(t.manage.chapterSaveError);
            return;
          }
          formRef.current?.reset();
          setOpen(false);
          // revalidatePath alone didn't always redraw the list in place
          // (seen in QA: the new chapter appeared only after a reload).
          router.refresh();
        });
      }}
      className="mb-6 w-full rounded-[12px] border border-border bg-card p-5.5"
    >
      <Input name="title" placeholder={t.create.chapterTitlePlaceholder} className="mb-3.5" required />
      <RichTextEditor name="content" placeholder={t.create.chapterTextPlaceholder} />
      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
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
