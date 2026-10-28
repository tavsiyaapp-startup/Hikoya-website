import "server-only";
import { isTelegramPlaceholderEmail } from "@/lib/telegram-account";
import { logQueryError } from "@/lib/queries/query-errors";
import { and, eq, count, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { achievements, profiles, stories, userAchievements } from "@/server/db/schema";
import type { Profile } from "@/types/database";

function toProfile(row: typeof profiles.$inferSelect): Profile {
  return {
    ...row,
    onboarded_at: row.onboarded_at ? row.onboarded_at.toISOString() : null,
    created_at: row.created_at.toISOString(),
    last_seen_at: row.last_seen_at ? row.last_seen_at.toISOString() : null,
    username_changed_at: row.username_changed_at ? row.username_changed_at.toISOString() : null,
  };
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  try {
    const db = getDb();
    // Case-insensitive: usernames are stored with the case the owner chose,
    // but /author/<name> must resolve however the link was cased.
    const [row] = await db.select().from(profiles).where(sql`lower(${profiles.username}) = ${username.toLowerCase()}`).limit(1);
    return row ? toProfile(row) : null;
  } catch (err) {
    logQueryError("getProfileByUsername", err);
    return null;
  }
}

// Used by /admin/users/[id] — the admin list links by id, not username.
export async function getProfileById(id: string): Promise<Profile | null> {
  try {
    const db = getDb();
    const [row] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    return row ? toProfile(row) : null;
  } catch (err) {
    logQueryError("getProfileById", err);
    return null;
  }
}

// How an account signs in, for the admin user page: its email (null for a
// Telegram-only account, whose stored address is only a placeholder) and
// whether a Telegram account is linked.
export async function getProfileLogin(id: string): Promise<{ email: string | null; telegramLinked: boolean }> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ email: profiles.email, telegram_id: profiles.telegram_id })
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);
    return {
      email: row?.email && !isTelegramPlaceholderEmail(row.email) ? row.email : null,
      telegramLinked: row?.telegram_id != null,
    };
  } catch (err) {
    logQueryError("getProfileLogin", err);
    return { email: null, telegramLinked: false };
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
  } catch (err) {
    logQueryError("getAuthorStoryCount", err);
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
  } catch (err) {
    logQueryError("getAuthorTotals", err);
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
  } catch (err) {
    logQueryError("getAuthorAchievements", err);
    return [];
  }
}
