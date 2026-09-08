import { clsx } from "clsx";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { formatTimestamp } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { ShieldIcon } from "@/components/ui/icons";
import type { ChatMessageWithSender } from "@/lib/queries/chat";

// Shared by both /chat (the user's own thread) and /admin/chats (a staff
// member looking at one user's thread) — which side a message renders on
// just depends on whether it matches the viewer's own role: a user's own
// messages are "mine" on their page, a staff member's own messages are
// "mine" on the admin page, regardless of which specific admin sent them.
export async function ChatMessages({
  messages,
  viewerIsStaff,
}: {
  messages: ChatMessageWithSender[];
  viewerIsStaff: boolean;
}) {
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => {
        const isOwn = m.is_admin === viewerIsStaff;
        // On the user's own page, admin replies are attributed to "support"
        // collectively, never to the specific admin who wrote them — same
        // anonymity the site already applies to moderation notifications.
        const showRealSender = viewerIsStaff || !m.is_admin;
        const senderName = showRealSender ? (m.sender?.display_name ?? "?") : t.chat.supportName;

        return (
          <div key={m.id} className={clsx("flex items-end gap-2.5", isOwn ? "flex-row-reverse" : "flex-row")}>
            {showRealSender ? (
              <Avatar name={senderName} src={m.sender?.avatar_url} size={30} className="mb-4" />
            ) : (
              <div className="mb-4 flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                <ShieldIcon width={15} height={15} />
              </div>
            )}
            <div className={clsx("flex max-w-[75%] flex-col", isOwn ? "items-end" : "items-start")}>
              {!isOwn && <span className="mb-1 px-1 text-[12px] font-bold text-muted-2">{senderName}</span>}
              <div
                className={clsx(
                  "rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed whitespace-pre-wrap",
                  isOwn ? "bg-primary-700 text-white" : "border border-border bg-card text-ink-soft"
                )}
              >
                {m.text}
              </div>
              <span className="mt-1 px-1 text-[11px] text-muted-3">{formatTimestamp(m.created_at, locale)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
