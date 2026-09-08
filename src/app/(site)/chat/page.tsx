import { redirect } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { getAdminChatMessages } from "@/lib/queries/chat";
import { ROUTES } from "@/lib/constants";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatMessageForm } from "@/components/chat/ChatMessageForm";
import { ChatScrollArea } from "@/components/chat/ChatScrollArea";
import { MarkChatRead } from "@/components/chat/MarkChatRead";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`${ROUTES.onboarding}?next=${encodeURIComponent(ROUTES.chat)}`);

  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const messages = await getAdminChatMessages(user.id);

  return (
    <div className="mx-auto max-w-165">
      <MarkChatRead as="user" />

      <h1 className="mb-1 text-2xl font-extrabold tracking-tight">{t.chat.title}</h1>
      <p className="mb-6 text-[14px] text-muted-2">{t.chat.subtitle}</p>

      <div className="rounded-[22px] border border-border bg-card p-4.5 sm:p-6.5">
        {messages.length > 0 ? (
          <ChatScrollArea>
            <ChatMessages messages={messages} viewerIsStaff={false} />
          </ChatScrollArea>
        ) : (
          <div className="mb-5 rounded-2xl border border-dashed border-border-soft bg-surface px-6 py-10 text-center text-[14px] text-muted">
            {t.chat.emptyState}
          </div>
        )}
        <ChatMessageForm targetUserId={user.id} path={ROUTES.chat} />
      </div>
    </div>
  );
}
