"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { createForumPostAction } from "@/lib/actions/forum";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { ForumCategory } from "@/types/database";

const MAX_TITLE = 200;
const MAX_BODY = 10000;

export function NewTopicForm({
  categories,
  defaultCategory,
}: {
  // «Eʼlon» is only offered to an admin (the server checks again).
  categories: ForumCategory[];
  defaultCategory: ForumCategory;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [category, setCategory] = useState<ForumCategory>(defaultCategory);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [storyRef, setStoryRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const errors: Record<string, string> = {
    title: t.forum.errTitle,
    body: t.forum.errBody,
    story: t.forum.errStory,
    category: t.forum.errCategory,
    rate_limited: t.forum.errRate,
    blocked: t.forum.errBlocked,
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3) {
      setError(t.forum.errTitle);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createForumPostAction({ category, title, body, storyRef: storyRef.trim() || undefined });
      if ("ok" in result) {
        router.push(ROUTES.forumPost(result.id));
        return;
      }
      if (result.error === "unauthorized") {
        router.push(ROUTES.onboarding);
        return;
      }
      setError(errors[result.error] ?? t.forum.errGeneric);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 rounded-[16px] border border-border bg-card p-4.5 sm:p-6.5">
      <div>
        <div className="mb-2 text-[13px] font-bold">{t.forum.categoryLabel}</div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={clsx(
                "h-9 cursor-pointer rounded-[10px] border px-3.5 text-[13px] font-semibold transition",
                category === c ? "border-primary-300 bg-primary-50 text-primary-900" : "border-border bg-card text-ink-soft hover:bg-surface"
              )}
            >
              {t.forum.categories[c]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] text-muted-2">{t.forum.categoryHints[category]}</p>
      </div>

      <div>
        <label htmlFor="topic-title" className="mb-1.5 block text-[13px] font-bold">
          {t.forum.titleLabel}
        </label>
        <Input id="topic-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MAX_TITLE} placeholder={t.forum.titlePlaceholder} required />
      </div>

      <div>
        <label htmlFor="topic-body" className="mb-1.5 block text-[13px] font-bold">
          {t.forum.bodyLabel} <span className="font-medium text-muted-2">{t.common.optional}</span>
        </label>
        <Textarea id="topic-body" value={body} onChange={(e) => setBody(e.target.value)} rows={7} maxLength={MAX_BODY} placeholder={t.forum.bodyPlaceholder} />
      </div>

      <div>
        <label htmlFor="topic-story" className="mb-1.5 block text-[13px] font-bold">
          {t.forum.storyLabel} <span className="font-medium text-muted-2">{t.common.optional}</span>
        </label>
        <Input id="topic-story" value={storyRef} onChange={(e) => setStoryRef(e.target.value)} placeholder="https://hikoya.org/story/…" inputMode="url" />
        <p className="mt-1 text-[12px] text-muted-2">{t.forum.storyHint}</p>
      </div>

      {error && <p className="text-[13px] font-semibold text-danger">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending || !title.trim()}>
          {pending ? t.common.loading : t.forum.submit}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}
