import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { profiles, requestResponses, requests, stories } from "@/server/db/schema";
import type { Request, RequestResponse, RequestStatus } from "@/types/database";

function toISO(d: Date): string {
  return d.toISOString();
}

async function attachResponseCounts(
  db: ReturnType<typeof getDb>,
  rows: (typeof requests.$inferSelect)[]
): Promise<Map<string, { id: string }[]>> {
  const map = new Map<string, { id: string }[]>();
  if (rows.length === 0) return map;
  const responseRows = await db
    .select({ id: requestResponses.id, request_id: requestResponses.request_id })
    .from(requestResponses)
    .where(inArray(requestResponses.request_id, rows.map((r) => r.id)));
  for (const r of responseRows) {
    const arr = map.get(r.request_id) ?? [];
    arr.push({ id: r.id });
    map.set(r.request_id, arr);
  }
  return map;
}

export type RequestWithResponses = Request & { responses: { id: string }[] };

// Requests a user submitted themselves (from_user_id) — the board is a
// shared/general pool (no per-author private targeting), so this is the
// only "which requests are mine" query. Powers the profile's "Мои заявки"
// tab so the requester can find and close their own requests.
export async function getRequestsBySubmitter(userId: string): Promise<RequestWithResponses[]> {
  try {
    const db = getDb();
    const rows = await db.select().from(requests).where(eq(requests.from_user_id, userId)).orderBy(desc(requests.created_at));
    const responsesByRequest = await attachResponseCounts(db, rows);
    return rows.map((r) => ({ ...r, created_at: toISO(r.created_at), responses: responsesByRequest.get(r.id) ?? [] }));
  } catch {
    return [];
  }
}

export type BoardRequest = Request & { from_user: { display_name: string }; responses: { id: string }[] };

export async function getBoardRequests(status?: string): Promise<BoardRequest[]> {
  try {
    const db = getDb();
    const where = status ? eq(requests.status, status as RequestStatus) : undefined;
    const rows = await db
      .select({ request: requests, from_user: { display_name: profiles.display_name } })
      .from(requests)
      .innerJoin(profiles, eq(requests.from_user_id, profiles.id))
      .where(where)
      .orderBy(desc(requests.created_at))
      .limit(50);
    const responsesByRequest = await attachResponseCounts(db, rows.map((r) => r.request));
    return rows.map((r) => ({
      ...r.request,
      created_at: toISO(r.request.created_at),
      from_user: r.from_user,
      responses: responsesByRequest.get(r.request.id) ?? [],
    }));
  } catch {
    return [];
  }
}

export type RequestWithAuthor = Request & { from_user: { display_name: string } };

export async function getRequestById(id: string): Promise<RequestWithAuthor | null> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ request: requests, from_user: { display_name: profiles.display_name } })
      .from(requests)
      .innerJoin(profiles, eq(requests.from_user_id, profiles.id))
      .where(eq(requests.id, id))
      .limit(1);
    if (!row) return null;
    return { ...row.request, created_at: toISO(row.request.created_at), from_user: row.from_user };
  } catch {
    return null;
  }
}

export type RequestResponseWithContext = RequestResponse & {
  author: { username: string; display_name: string };
  story: { slug: string; title: string } | null;
};

export async function getRequestResponses(requestId: string): Promise<RequestResponseWithContext[]> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        response: requestResponses,
        author: { username: profiles.username, display_name: profiles.display_name },
        story: { slug: stories.slug, title: stories.title },
      })
      .from(requestResponses)
      .innerJoin(profiles, eq(requestResponses.author_id, profiles.id))
      .leftJoin(stories, eq(requestResponses.story_id, stories.id))
      .where(eq(requestResponses.request_id, requestId))
      .orderBy(desc(requestResponses.created_at));
    return rows.map((r) => ({
      ...r.response,
      created_at: toISO(r.response.created_at),
      author: r.author,
      story: r.response.story_id ? r.story : null,
    }));
  } catch {
    return [];
  }
}

// A story is "written per a request" when some response to a request
// attached it via request_responses.story_id (set in respondToRequest).
export async function getLinkedRequestForStory(storyId: string): Promise<string | null> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ request_id: requestResponses.request_id })
      .from(requestResponses)
      .where(eq(requestResponses.story_id, storyId))
      .limit(1);
    return row?.request_id ?? null;
  } catch {
    return null;
  }
}
