import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin panel reads always use the service-role client — staff need to see
// everything regardless of RLS (draft stories, all users, all reports).
// There's no dedicated audit-log table yet, so the dashboard's "recent
// activity" feed is derived from recent stories/users/reports instead of a
// true event log.

export async function getAdminStats() {
  try {
    const admin = createAdminClient();
    const [{ count: storyCount }, { count: userCount }, { data: views }, { count: commentCount }] =
      await Promise.all([
        admin.from("stories").select("id", { count: "exact", head: true }),
        admin.from("profiles").select("id", { count: "exact", head: true }),
        admin.from("stories").select("view_count"),
        admin.from("comments").select("id", { count: "exact", head: true }),
      ]);
    const totalViews = (views ?? []).reduce((sum, s) => sum + (s.view_count ?? 0), 0);
    return {
      storyCount: storyCount ?? 0,
      userCount: userCount ?? 0,
      totalViews,
      commentCount: commentCount ?? 0,
    };
  } catch {
    return { storyCount: 0, userCount: 0, totalViews: 0, commentCount: 0 };
  }
}

export async function getRecentStoriesAdmin(limit = 6) {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("stories")
      .select("id, title, slug, cover_url, status, created_at, author:profiles!stories_author_id_fkey(display_name)")
      .order("created_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getRecentUsersAdmin(limit = 6) {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("id, display_name, username, created_at, status, role")
      .order("created_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getRecentReportsAdmin(limit = 6) {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("reports")
      .select("*, reporter:profiles!reports_reporter_id_fkey(display_name)")
      .order("created_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function searchUsersAdmin(query?: string) {
  try {
    const admin = createAdminClient();
    let q = admin.from("profiles").select("*").order("created_at", { ascending: false });
    if (query) q = q.or(`display_name.ilike.%${query}%,username.ilike.%${query}%`);
    const { data } = await q.limit(100);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getAllStoriesAdmin(statusFilter?: string) {
  try {
    const admin = createAdminClient();
    let q = admin
      .from("stories")
      .select("*, author:profiles!stories_author_id_fkey(display_name)")
      .order("created_at", { ascending: false });
    if (statusFilter) q = q.eq("status", statusFilter);
    const { data } = await q.limit(100);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getStoryChapterCounts(storyIds: string[]) {
  if (storyIds.length === 0) return {} as Record<string, number>;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("chapters").select("story_id").in("story_id", storyIds);
    const counts: Record<string, number> = {};
    for (const row of data ?? []) counts[row.story_id] = (counts[row.story_id] ?? 0) + 1;
    return counts;
  } catch {
    return {};
  }
}

export async function getAllReportsAdmin(statusFilter?: string) {
  try {
    const admin = createAdminClient();
    let q = admin
      .from("reports")
      .select("*, reporter:profiles!reports_reporter_id_fkey(display_name)")
      .order("created_at", { ascending: false });
    if (statusFilter) q = q.eq("status", statusFilter);
    const { data } = await q.limit(100);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getReportStats() {
  try {
    const admin = createAdminClient();
    const [{ count: open }, { count: reviewed }, { count: resolved }] = await Promise.all([
      admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "reviewed"),
      admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "resolved"),
    ]);
    return { open: open ?? 0, reviewed: reviewed ?? 0, resolved: resolved ?? 0 };
  } catch {
    return { open: 0, reviewed: 0, resolved: 0 };
  }
}

export async function getPlatformSettingsAdmin() {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("platform_settings").select("*").eq("id", 1).single();
    return data;
  } catch {
    return null;
  }
}
