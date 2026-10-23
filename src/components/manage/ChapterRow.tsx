"use client";

import { useState, useTransition } from "react";
import { updateChapter, deleteChapter, submitChapterForReview } from "@/lib/actions/stories";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Badge } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Button } from "@/components/ui/Button";
import type { Chapter } from "@/types/database";
import { plural } from "@/lib/plural";

export function ChapterRow({
  chapter,
  storyId,
  storySlug,
  isLast,
}: {
  chapter: Chapter;
  storyId: string;
  storySlug: string;
  isLast: boolean;
}) {
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const [note, setNote] = useState(false);
  const [needsSubscription, setNeedsSubscription] = useState(false);

  function handleDelete() {
    if (!window.confirm(t.manage.confirmDeleteChapter)) return;
    setError(false);
    startTransition(async () => {
      if (!(await deleteChapter(chapter.id, storyId, storySlug))) setError(true);
    });
  }

  function handleSubmitForReview() {
    setError(false);
    startTransition(async () => {
      const result = await submitChapterForReview(chapter.id, storyId, storySlug);
      if (result === "subscription") setNeedsSubscription(true);
      else if (!result) setError(true);
    });
  }

  // onSubmit rather than <form action>: React resets an action form after it
  // runs, which would wipe the edited text when the save is refused.
  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(false);
    setNote(false);
    startTransition(async () => {
      const result = await updateChapter(chapter.id, storyId, storySlug, formData);
      if (result === false) {
        setError(true);
        return;
      }
      setNote(result === "review");
      setEditing(false);
    });
  }

  const errorLine = error && <p className="text-[12.5px] font-semibold text-danger">{t.common.error}</p>;

  const border = !isLast ? "border-b border-border-soft" : "";

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className={`flex flex-col gap-2.5 px-5.5 py-4 ${border}`}
      >
        <Input name="title" defaultValue={chapter.title} required />
        <RichTextEditor name="content" defaultValue={chapter.content} />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? t.common.loading : t.common.save}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            {t.common.cancel}
          </Button>
        </div>
        {errorLine}
      </form>
    );
  }

  return (
    <div className={`px-4 py-4 sm:px-5.5 ${border}`}>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 sm:flex-nowrap">
        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
          <div className="mb-0.5 text-[15px] font-bold">{chapter.title}</div>
          <div className="text-[12.5px] text-muted-3">
            {chapter.word_count} {plural(chapter.word_count, t.reader.wordsLabel)}
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
        {chapter.status === "draft" && (
          <button
            type="button"
            disabled={pending}
            onClick={handleSubmitForReview}
            className="cursor-pointer text-[12.5px] font-bold text-primary-800 disabled:opacity-50"
          >
            {t.manage.submitForReview}
          </button>
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
      {errorLine && <div className="mt-2">{errorLine}</div>}
      {note && <p className="mt-2 text-[12.5px] font-semibold text-amber-800 dark:text-amber-300">{t.manage.chapterBackToReview}</p>}
      {needsSubscription && (
        <p className="mt-2 text-[12.5px] font-semibold text-primary-800">
          {t.paywall.publishNeedsSubscription} — <a href="#publish-subscription" className="underline">{t.paywall.subscribeButton}</a>
        </p>
      )}
      {chapter.status === "draft" && chapter.rejection_reason && (
        <div className="mt-3 rounded-[12px] bg-danger-bg px-3.5 py-2.5">
          <div className="mb-0.5 text-[12px] font-bold text-danger">{t.manage.rejectionReasonLabel}</div>
          <p className="text-[13px] leading-relaxed text-ink-soft">{chapter.rejection_reason}</p>
        </div>
      )}
    </div>
  );
}
