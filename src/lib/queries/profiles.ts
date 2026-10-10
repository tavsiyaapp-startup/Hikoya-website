import "server-only";
import { and, eq, count, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { achievements, profiles, stories, userAchievements } from "@/server/db/schema";
import type { Profile } from "@/types/database";

function toProfile(row: typeof profiles.$inferSelect): Profile {
  return {
    ...row,
    onboarded_at: row.onboarded_at ? row.onboarded_at.toISOString() : null,
    created_at: row.created_at.toISOString(),
  };
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  try {
    const db = getDb();
    const [row] = await db.select().from(profiles).where(eq(profiles.username, username)).limit(1);
    return row ? toProfile(row) : null;
  } catch {
    return null;
  }
}

// Used by /admin/users/[id] — the admin list links by id, not username.
export async function getProfileById(id: string): Promise<Profile | null> {
  try {
    const db = getDb();
    const [row] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    return row ? toProfile(row) : null;
  } catch {
    return null;
  }
}

export async function getAuthorStoryCount(authorId: string) {
  try {
    const db = getDb();
    const [{ total }] = await db
      .select({ total: count() })
      .from(stories)
      .where(and(eq(stories.author_id, authorId), eq(stories.status, "published")));
    return total;
  } catch {
    return 0;
  }
}

export async function getAuthorTotals(authorId: string) {
  try {
    const db = getDb();
    const [{ totalLikes }] = await db
      .select({ totalLikes: sql<number>`coalesce(sum(${stories.like_count}), 0)` })
      .from(stories)
      .where(and(eq(stories.author_id, authorId), eq(stories.status, "published")));
    return { totalLikes: Number(totalLikes) };
  } catch {
    return { totalLikes: 0 };
  }
}

export async function getAuthorAchievements(userId: string) {
  try {
    const db = getDb();
    const rows = await db
      .select({
        achievement: { code: achievements.code, title_ru: achievements.title_ru, title_uz: achievements.title_uz },
      })
      .from(userAchievements)
      .innerJoin(achievements, eq(userAchievements.achievement_id, achievements.id))
      .where(eq(userAchievements.user_id, userId));
    return rows;
  } catch {
    return [];
  }
}
