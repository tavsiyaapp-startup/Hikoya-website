import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getAdminChatsList, getAdminChatMessages, getProfileForChat, type AdminChatListItem } from "@/lib/queries/chat";
import { formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/constants";
import { AdminHeader } from "../AdminHeader";
import { Avatar } from "@/components/ui/Avatar";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatMessageForm } from "@/components/chat/ChatMessageForm";
import { ChatScrollArea } from "@/components/chat/ChatScrollArea";
import { MarkChatRead } from "@/components/chat/MarkChatRead";

export default async function AdminChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ selected?: string }>;
}) {
  const { selected } = await searchParams;
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  const chats = await getAdminChatsList();
  let selectedChat: AdminChatListItem | undefined = selected ? chats.find((c) => c.user_id === selected) : undefined;

  // Admin opened /admin/chats?selected=X for a user with no conversation
  // yet (e.g. "Написать" from /admin/users) — no admin_chats row exists
  // until the first message is actually sent, so build a placeholder pane
  // from the profile alone.
  if (selected && !selectedChat) {
    const profile = await getProfileForChat(selected);
    if (profile) {
      selectedChat = {
        user_id: selected,
        last_message_at: new Date().toISOString(),
        last_message_preview: "",
        last_sender_is_admin: false,
        unread_by_admin: false,
        unread_by_user: false,
        user: profile,
      };
    }
  }

  const messages = selectedChat ? await getAdminChatMessages(selectedChat.user_id) : [];

  return (
    <div>
      <AdminHeader title={t.admin.chatsTitle} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <div className="flex flex-col items-start gap-5.5 lg:flex-row">
          <div className="grid w-full min-w-0 flex-1 grid-cols-1 gap-3">
            {chats.length > 0 ? (
              chats.map((c) => (
                <Link
                  key={c.user_id}
                  href={ROUTES.adminChats(c.user_id)}
                  className={`flex items-center gap-3.5 rounded-[18px] border bg-card p-4 ${
                    selected === c.user_id ? "border-primary-400" : "border-border hover:border-primary-200"
                  }`}
                >
                  <Avatar name={c.user?.display_name ?? "?"} src={c.user?.avatar_url} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14.5px] font-bold">{c.user?.display_name}</span>
                      {c.unread_by_admin && <span className="h-2 w-2 shrink-0 rounded-full bg-danger" />}
                    </div>
                    <p className="truncate text-[13px] text-muted-2">{c.last_message_preview}</p>
                  </div>
                  <span className="shrink-0 text-[12px] text-muted-3">
                    {formatDateTime(c.last_message_at, locale)}
                  </span>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border-soft bg-surface px-6 py-14 text-center text-[14px] text-muted">
                {t.admin.noChatsYet}
              </div>
            )}
          </div>

          {selectedChat && (
            <div className="w-full shrink-0 overflow-hidden rounded-[22px] border border-border bg-card p-5 lg:sticky lg:top-26 lg:w-100">
              <MarkChatRead as="admin" targetUserId={selectedChat.user_id} />
              <div className="mb-4 flex items-center gap-3">
                <Avatar name={selectedChat.user?.display_name ?? "?"} src={selectedChat.user?.avatar_url} size={36} />
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-bold">{selectedChat.user?.display_name}</div>
                  <div className="truncate text-[12.5px] text-muted-2">@{selectedChat.user?.username}</div>
                </div>
              </div>

              {messages.length > 0 ? (
                <ChatScrollArea>
                  <ChatMessages messages={messages} viewerIsStaff />
                </ChatScrollArea>
              ) : (
                <div className="mb-5 rounded-2xl border border-dashed border-border-soft bg-surface px-6 py-8 text-center text-[13.5px] text-muted">
                  {t.chat.emptyState}
                </div>
              )}
              <ChatMessageForm targetUserId={selectedChat.user_id} path={ROUTES.adminChats(selectedChat.user_id)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
