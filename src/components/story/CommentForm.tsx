"use client";

import { useRef, useState, useTransition } from "react";
import { postComment } from "@/lib/actions/social";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { EmojiPickerButton } from "@/components/story/EmojiPickerButton";

export function CommentForm({
  chapterId,
  path,
  parentId,
  onSuccess,
  autoFocus,
}: {
  chapterId: string;
  path: string;
  parentId?: string;
  onSuccess?: () => void;
  autoFocus?: boolean;
}) {
  const { t } = useLocale();
  const [text, setText] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    startTransition(async () => {
      await postComment(chapterId, text, path, parentId, isSpoiler);
      setText("");
      setIsSpoiler(false);
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

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      <div className="flex items-start gap-3">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.reader.commentPlaceholder}
          rows={2}
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
        <Button type="submit" disabled={pending || !text.trim()} className="shrink-0">
          {parentId ? t.manage.reply : t.reader.commentSubmit}
        </Button>
      </div>
    </form>
  );
}
