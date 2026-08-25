"use client";

import { useRef, useState, useTransition } from "react";
import { postComment } from "@/lib/actions/social";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

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
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    startTransition(async () => {
      await postComment(chapterId, text, path, parentId);
      setText("");
      onSuccess?.();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex items-start gap-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.reader.commentPlaceholder}
        rows={2}
        autoFocus={autoFocus}
        className="flex-1"
      />
      <Button type="submit" disabled={pending || !text.trim()} className="mt-0.5 shrink-0">
        {parentId ? t.manage.reply : t.reader.commentSubmit}
      </Button>
    </form>
  );
}
