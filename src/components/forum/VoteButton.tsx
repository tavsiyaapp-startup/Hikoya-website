"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { toggleForumVoteAction } from "@/lib/actions/forum";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";

function UpArrow({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M12 4 4 13h5v7h6v-7h5z" />
    </svg>
  );
}

// ▲ and the number of votes. Only "up" exists (owner's decision). A guest
// is sent to sign in; one's own topic and a blocked account just show the
// count.
export function VoteButton({
  postId,
  voted,
  count,
  state,
  horizontal,
}: {
  postId: string;
  voted: boolean;
  count: number;
  state: "can" | "guest" | "own" | "blocked";
  horizontal?: boolean;
}) {
  const { t } = useLocale();
  const [isVoted, setVoted] = useState(voted);
  const [total, setTotal] = useState(count);
  const [pending, startTransition] = useTransition();

  const box = clsx(
    "flex shrink-0 items-center justify-center gap-1 rounded-[12px] border font-extrabold transition",
    horizontal ? "h-10 flex-row px-3 text-[14px]" : "w-12 flex-col py-2 text-[14px]",
    isVoted ? "border-primary-300 bg-primary-50 text-primary-800" : "border-border bg-card text-ink-soft"
  );

  if (state === "guest") {
    return (
      <Link prefetch={false} href={ROUTES.onboarding} title={t.forum.signInToVote} aria-label={t.forum.signInToVote} className={clsx(box, "hover:border-primary-200")}>
        <UpArrow filled={false} />
        <span>{total}</span>
      </Link>
    );
  }

  if (state !== "can") {
    return (
      <span title={state === "own" ? t.forum.ownTopicVote : undefined} className={clsx(box, "opacity-70")}>
        <UpArrow filled={isVoted} />
        <span>{total}</span>
      </span>
    );
  }

  function toggle() {
    const next = !isVoted;
    setVoted(next);
    setTotal((n) => n + (next ? 1 : -1));
    startTransition(async () => {
      const result = await toggleForumVoteAction(postId);
      if (!result) {
        setVoted(!next);
        setTotal((n) => n + (next ? -1 : 1));
        return;
      }
      setVoted(result.voted);
      setTotal(result.count);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={isVoted}
      aria-label={t.forum.vote}
      title={t.forum.vote}
      className={clsx(box, "cursor-pointer hover:border-primary-300 hover:text-primary-800")}
    >
      <UpArrow filled={isVoted} />
      <span>{total}</span>
    </button>
  );
}
