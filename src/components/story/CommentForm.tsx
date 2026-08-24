"use client";

import { useRef, useState, useTransition } from "react";
import { postComment } from "@/lib/actions/social";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

export function CommentForm({ chapterId, path }: { chapterId: string; path: string }) {
  const { t } = useLocale();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    startTransition(async () => {
      await postComment(chapterId, text, path);
      setText("");
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mb-5 flex items-start gap-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ваш комментарий…"
        rows={2}
        className="flex-1"
      />
      <Button type="submit" disabled={pending || !text.trim()} className="mt-0.5 shrink-0">
        {t.manage.reply}
      </Button>
    </form>
  );
}
