import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getRequestsForAuthor(authorId: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("requests")
      .select("*, from_user:profiles!requests_from_user_id_fkey(display_name)")
      .eq("target_author_id", authorId)
      .order("created_at", { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

// Requests a user submitted themselves (from_user_id) — distinct from
// getRequestsForAuthor, which is requests OTHERS sent this author asking
// them to write something. This is what the profile's own "Мои заявки"
// tab needs so the requester can find and close their own requests.
export async function getRequestsBySubmitter(userId: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("requests")
      .select("*, responses:request_responses(id)")
      .eq("from_user_id", userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getBoardRequests(status?: string) {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("requests")
      .select(
        "*, from_user:profiles!requests_from_user_id_fkey(display_name), responses:request_responses(id)"
      )
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data } = await query.limit(50);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getRequestById(id: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("requests")
      .select("*, from_user:profiles!requests_from_user_id_fkey(display_name)")
      .eq("id", id)
      .single();
    return data;
  } catch {
    return null;
  }
}

export async function getRequestResponses(requestId: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("request_responses")
      .select(
        "*, author:profiles!request_responses_author_id_fkey(username, display_name), story:stories(slug, title)"
      )
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

// A story is "written per a request" when some response to a request
// attached it via request_responses.story_id (set in respondToRequest).
export async function getLinkedRequestForStory(storyId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("request_responses")
      .select("request_id")
      .eq("story_id", storyId)
      .limit(1)
      .maybeSingle();
    return data?.request_id ?? null;
  } catch {
    return null;
  }
}
