"use client";

import { useRef, useState, useTransition } from "react";
import { postComment, editComment } from "@/lib/actions/social";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSubscribeGate } from "@/components/paywall/SubscribeGateProvider";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { EmojiPickerButton } from "@/components/story/EmojiPickerButton";
import { CommentBlockedNotice } from "@/components/story/CommentBlockedNotice";

export function CommentForm({
  storyId,
  chapterId,
  path,
  parentId,
  onSuccess,
  autoFocus,
  blocked,
  editCommentId,
  initialText,
  initialSpoiler,
  onCancel,
  onEdited,
}: {
  storyId: string;
  // null when posting from the story page's own "Комментарии" tab (all
  // chapters at once) rather than under one specific chapter.
  chapterId: string | null;
  path: string;
  parentId?: string;
  onSuccess?: () => void;
  autoFocus?: boolean;
  // Blocked accounts see a notice instead of the form.
  blocked?: boolean;
  // Edit mode: when set, the form edits this existing comment (its own author
  // only, enforced server-side) instead of posting a new one.
  editCommentId?: string;
  initialText?: string;
  initialSpoiler?: boolean;
  onCancel?: () => void;
  // Called after a successful edit with the saved values, so the parent can
  // update what it shows without a refetch.
  onEdited?: (text: string, isSpoiler: boolean) => void;
}) {
  const { t } = useLocale();
  const { guard } = useSubscribeGate();
  const [text, setText] = useState(initialText ?? "");
  const [isSpoiler, setIsSpoiler] = useState(initialSpoiler ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    // Commenting is a paid action — a non-subscriber gets the subscribe dialog.
    if (!guard()) return;
    setError(null);
    startTransition(async () => {
      // The text is only cleared once the server confirms the comment was
      // saved. Before, a refused comment (too long, blocked account, story
      // no longer visible) was silently dropped and the text vanished.
      const result = editCommentId
        ? await editComment(editCommentId, text, isSpoiler, path)
        : await postComment(storyId, chapterId, text, path, parentId, isSpoiler);
      if ("error" in result) {
        setError(result.error === "too_long" ? t.reader.commentTooLong : t.reader.commentPostError);
        return;
      }
      // Keep the text in edit mode (the parent closes the form on success); only
      // the new-comment/reply form resets itself for the next one.
      if (editCommentId) {
        onEdited?.(text.trim(), isSpoiler);
      } else {
        setText("");
        setIsSpoiler(false);
      }
      onSuccess?.();
    });
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      setText((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }

  if (blocked) return <CommentBlockedNotice />;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      <div className="flex items-start gap-3">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.reader.commentPlaceholder}
          rows={2}
          maxLength={5000}
          autoFocus={autoFocus}
          className="flex-1"
        />
        <EmojiPickerButton onSelect={insertEmoji} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-muted-2">
          <input
            type="checkbox"
            checked={isSpoiler}
            onChange={(e) => setIsSpoiler(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-primary-600"
          />
          {t.reader.spoilerCheckboxLabel}
        </label>
        <div className="flex shrink-0 items-center gap-2">
          {editCommentId && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="shrink-0 px-2 text-[13px] font-semibold text-muted-2 hover:text-ink-soft"
            >
              {t.common.cancel}
            </button>
          )}
          <Button type="submit" disabled={pending || !text.trim()} className="shrink-0">
            {editCommentId ? t.common.save : parentId ? t.manage.reply : t.reader.commentSubmit}
          </Button>
        </div>
      </div>
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
    </form>
  );
}
