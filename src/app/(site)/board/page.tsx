import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { getForumPostIdByLegacyRequest } from "@/server/data/forum";
import { ROUTES } from "@/lib/constants";

// The old «Soʻrovlar doskasi» became Muhokamalar (23.10.2026); its requests
// were copied in as «Soʻrov» topics. Old links keep working:
// /board → the Soʻrov list, /board?selected=<request id> → that topic.
export default async function BoardRedirect({ searchParams }: { searchParams: Promise<{ selected?: string }> }) {
  const { selected } = await searchParams;
  const postId = selected ? await getForumPostIdByLegacyRequest(getDb(), selected).catch(() => null) : null;
  redirect(postId ? ROUTES.forumPost(postId) : `${ROUTES.forum}?category=sorov`);
}
