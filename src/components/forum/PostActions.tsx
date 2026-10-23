"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteForumPostAction, moderateForumPostAction, reportForumItemAction } from "@/lib/actions/forum";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";
import { ReportCommentButton } from "@/components/story/ReportCommentButton";
import type { ForumModeration } from "@/server/data/forum";

// Under a topic: its author can delete it; staff can also pin, close for
// comments and hide it; anyone else signed in can complain about it.
export function PostActions({
  postId,
  own,
  isStaff,
  signedIn,
  isPinned,
  isLocked,
  hidden,
}: {
  postId: string;
  own: boolean;
  isStaff: boolean;
  signedIn: boolean;
  isPinned: boolean;
  isLocked: boolean;
  hidden: boolean;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function moderate(action: ForumModeration) {
    startTransition(async () => {
      const result = await moderateForumPostAction(postId, action);
      if ("error" in result) window.alert(t.forum.errGeneric);
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(t.forum.deleteTopicConfirm)) return;
    startTransition(async () => {
      const result = await deleteForumPostAction(postId);
      if ("ok" in result) router.push(ROUTES.forum);
      else window.alert(t.forum.errGeneric);
    });
  }

  const linkClass = "cursor-pointer text-[13px] font-bold text-muted-2 transition hover:text-primary-800 disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {isStaff && (
        <>
          <button type="button" disabled={pending} onClick={() => moderate(isPinned ? "unpin" : "pin")} className={linkClass}>
            📌 {isPinned ? t.forum.unpin : t.forum.pin}
          </button>
          <button type="button" disabled={pending} onClick={() => moderate(isLocked ? "unlock" : "lock")} className={linkClass}>
            🔒 {isLocked ? t.forum.unlock : t.forum.lock}
          </button>
          <button type="button" disabled={pending} onClick={() => moderate(hidden ? "unhide" : "hide")} className={linkClass}>
            {hidden ? t.forum.unhide : t.forum.hide}
          </button>
        </>
      )}
      {(own || isStaff) && (
        <button type="button" disabled={pending} onClick={remove} className="cursor-pointer text-[13px] font-bold text-muted-3 transition hover:text-danger disabled:opacity-50">
          {t.forum.delete}
        </button>
      )}
      {signedIn && !own && (
        <ReportCommentButton commentId={postId} send={(reason, details) => reportForumItemAction({ postId }, reason, details)} />
      )}
    </div>
  );
}
