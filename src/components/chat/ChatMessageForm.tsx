"use client";

import { useState, useTransition } from "react";
import { sendAdminChatMessage } from "@/lib/actions/admin-chat";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

export function ChatMessageForm({ targetUserId, path }: { targetUserId: string; path: string }) {
  const { t } = useLocale();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!text.trim()) return;
    startTransition(async () => {
      await sendAdminChatMessage(targetUserId, text, path);
      setText("");
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-end gap-3"
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.chat.placeholder}
        rows={2}
        className="flex-1"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <Button type="submit" disabled={pending || !text.trim()} className="shrink-0">
        {t.chat.send}
      </Button>
    </form>
  );
}
