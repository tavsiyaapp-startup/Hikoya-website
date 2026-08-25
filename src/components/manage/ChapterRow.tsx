"use client";

import { useState, useTransition } from "react";
import { updateChapter, deleteChapter } from "@/lib/actions/stories";
import { approveChapter, rejectChapter } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Badge } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import type { Chapter } from "@/types/database";

export function ChapterRow({
  chapter,
  storyId,
  storySlug,
  isLast,
  isStaff,
}: {
  chapter: Chapter;
  storyId: string;
  storySlug: string;
  isLast: boolean;
  isStaff: boolean;
}) {
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(t.manage.confirmDeleteChapter)) return;
    startTransition(() => {
      deleteChapter(chapter.id, storyId, storySlug);
    });
  }

  const border = !isLast ? "border-b border-border-soft" : "";

  if (editing) {
    return (
      <form
        action={(formData) =>
          startTransition(async () => {
            await updateChapter(chapter.id, storyId, storySlug, formData);
            setEditing(false);
          })
        }
        className={`flex flex-col gap-2.5 px-5.5 py-4 ${border}`}
      >
        <Input name="title" defaultValue={chapter.title} required />
        <Textarea name="content" defaultValue={chapter.content} rows={8} required />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? t.common.loading : t.common.save}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            {t.common.cancel}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-3.5 gap-y-2 px-4 py-4 sm:flex-nowrap sm:px-5.5 ${border}`}>
      <div className="min-w-0 flex-1 basis-full sm:basis-auto">
        <div className="mb-0.5 text-[15px] font-bold">{chapter.title}</div>
        <div className="text-[12.5px] text-muted-3">
          {chapter.word_count} {t.reader.wordsLabel}
        </div>
      </div>
      <div className="w-16 shrink-0 text-[14px] font-bold sm:w-24">{chapter.view_count}</div>
      <Badge
        tone={
          chapter.status === "published" ? "success" : chapter.status === "pending_review" ? "warning" : "neutral"
        }
      >
        {chapter.status === "published"
          ? t.common.published
          : chapter.status === "pending_review"
            ? t.common.pendingReview
            : t.common.draft}
      </Badge>
      {isStaff && chapter.status === "pending_review" && (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => approveChapter(chapter.id, storyId, storySlug))}
            className="cursor-pointer text-[12.5px] font-bold text-success disabled:opacity-50"
          >
            {t.manage.approve}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => rejectChapter(chapter.id, storyId, storySlug))}
            className="cursor-pointer text-[12.5px] font-bold text-danger disabled:opacity-50"
          >
            {t.manage.reject}
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="cursor-pointer text-[12.5px] font-bold text-primary-800"
      >
        {t.manage.editChapter}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={handleDelete}
        className="cursor-pointer text-[12.5px] font-bold text-danger disabled:opacity-50"
      >
        {t.manage.delete}
      </button>
    </div>
  );
}
