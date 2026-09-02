import "server-only";
import { ROUTES } from "@/lib/constants";

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// Reuses the support-ticket group (TELEGRAM_SUPPORT_GROUP_CHAT_ID) by
// default — set TELEGRAM_MODERATION_CHAT_ID separately if moderation pings
// should land in their own chat instead. Silently no-ops without a token/
// chat id configured, same tolerance-of-unreachable-external-service
// pattern the rest of this codebase uses for Supabase.
async function notifyModerationChat(text: string) {
  const chatId = process.env.TELEGRAM_MODERATION_CHAT_ID || process.env.TELEGRAM_SUPPORT_GROUP_CHAT_ID;
  if (!process.env.TELEGRAM_BOT_TOKEN || !chatId) return;
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.error("telegram moderation notification failed:", err);
  }
}

// A new story or chapter that landed in 'pending_review' (platform_settings
// .new_story_requires_review) — nudges staff that something is sitting in
// the moderation queue instead of them having to notice it in /admin/stories.
export async function notifyPendingReview(params: {
  kind: "story" | "chapter";
  authorName: string;
  storyTitle: string;
  chapterTitle?: string;
  storyId: string;
}) {
  const what =
    params.kind === "story"
      ? `новую историю «${params.storyTitle}»`
      : `новую главу «${params.chapterTitle}» в истории «${params.storyTitle}»`;
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  const link = base ? `${base}${ROUTES.adminStory(params.storyId)}` : null;

  const text = [
    `📝 ${params.authorName} опубликовал(а) ${what}`,
    "Ожидает подтверждения модератора.",
    link,
  ]
    .filter(Boolean)
    .join("\n");

  await notifyModerationChat(text);
}
