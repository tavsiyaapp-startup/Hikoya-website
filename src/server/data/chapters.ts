import "server-only";
import { and, eq, gt, max, sql } from "drizzle-orm";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  canAddChapter,
  canEditChapter,
  canSubmitChapterForReview,
  canViewChapter,
  type ChapterRecord,
  type Viewer,
} from "@/server/authz/policy";
import type { DbOrTx } from "@/server/db/client";
import { chapters, stories } from "@/server/db/schema";
import { ForbiddenError, NotFoundError } from "@/server/data/errors";
import { getStoryRecord } from "@/server/data/stories";
import { getRequiresReview } from "@/server/data/settings";
import { computeChapterStatus, nextOrderIndex, wordCount } from "@/server/data/logic";

const chapterRecordColumns = {
  id: chapters.id,
  story_id: chapters.story_id,
  status: chapters.status,
} as const;

export async function getChapterRecord(db: DbOrTx, chapterId: string): Promise<ChapterRecord | null> {
  const [row] = await db.select(chapterRecordColumns).from(chapters).where(eq(chapters.id, chapterId)).limit(1);
  return row ?? null;
}

// Same masking rule as requireViewableStory: missing and forbidden look identical.
export async function requireViewableChapter(db: DbOrTx, viewer: Viewer | null, chapterId: string) {
  const chapter = await getChapterRecord(db, chapterId);
  if (!chapter) throw new NotFoundError("Chapter");
  const story = await getStoryRecord(db, chapter.story_id);
  if (!story || !canViewChapter(viewer, chapter, story)) throw new NotFoundError("Chapter");
  return { chapter, story };
}

async function requireEditableChapter(db: DbOrTx, viewer: Viewer | null, chapterId: string) {
  const chapter = await getChapterRecord(db, chapterId);
  if (!chapter) throw new NotFoundError("Chapter");
  const story = await getStoryRecord(db, chapter.story_id);
  if (!story) throw new NotFoundError("Chapter");
  if (!canEditChapter(viewer, chapter, story)) throw new ForbiddenError();
  return { chapter, story };
}

export interface ChapterInput {
  title: string;
  content: string;
}

// Locks the story row for the duration of the transaction so two concurrent
// addChapter calls on the same story can't both read the same max(order_index)
// and insert at the same position — see backend_functions.md finding 10.
export async function addChapter(db: DbOrTx, viewer: Viewer | null, storyId: string, input: ChapterInput) {
  const title = input.title.trim();
  const content = sanitizeHtml(input.content.trim());
  if (!title || !content) throw new Error("Title and content are required");

  return db.transaction(async (tx) => {
    const [storyRow] = await tx
      .select({ id: stories.id, author_id: stories.author_id, status: stories.status, visibility: stories.visibility, deleted_at: stories.deleted_at })
      .from(stories)
      .where(eq(stories.id, storyId))
      .for("update");
    if (!storyRow) throw new NotFoundError("Story");
    if (!canAddChapter(viewer, storyRow)) throw new ForbiddenError();

    const [{ value }] = await tx.select({ value: max(chapters.order_index) }).from(chapters).where(eq(chapters.story_id, storyId));
    const orderIndex = nextOrderIndex(value);
    const requiresReview = await getRequiresReview(tx);
    const status = computeChapterStatus(requiresReview);

    const [chapter] = await tx
      .insert(chapters)
      .values({
        story_id: storyId,
        order_index: orderIndex,
        title,
        content,
        word_count: wordCount(content),
        status,
        is_free: false,
        published_at: status === "published" ? new Date() : null,
      })
      .returning();
    return chapter;
  });
}

export async function updateChapter(db: DbOrTx, viewer: Viewer | null, chapterId: string, input: ChapterInput) {
  const { chapter } = await requireEditableChapter(db, viewer, chapterId);
  const title = input.title.trim();
  const content = sanitizeHtml(input.content.trim());
  if (!title || !content) throw new Error("Title and content are required");

  await db
    .update(chapters)
    .set({ title, content, word_count: wordCount(content), updated_at: new Date() })
    .where(eq(chapters.id, chapter.id));
}

// The reorder after a delete was previously a loop of one UPDATE per chapter
// (backend_functions.md finding 10) — here it is one statement.
export async function deleteChapter(db: DbOrTx, viewer: Viewer | null, chapterId: string): Promise<void> {
  const { chapter } = await requireEditableChapter(db, viewer, chapterId);

  await db.transaction(async (tx) => {
    const [deleted] = await tx.delete(chapters).where(eq(chapters.id, chapterId)).returning({ order_index: chapters.order_index });
    if (!deleted) return;
    await tx
      .update(chapters)
      .set({ order_index: sql`${chapters.order_index} - 1` })
      .where(and(eq(chapters.story_id, chapter.story_id), gt(chapters.order_index, deleted.order_index)));
  });
}

export async function submitChapterForReview(db: DbOrTx, viewer: Viewer | null, chapterId: string): Promise<void> {
  const chapter = await getChapterRecord(db, chapterId);
  if (!chapter) throw new NotFoundError("Chapter");
  const story = await getStoryRecord(db, chapter.story_id);
  if (!story) throw new NotFoundError("Chapter");
  if (!canSubmitChapterForReview(viewer, chapter, story)) throw new ForbiddenError();

  const requiresReview = await getRequiresReview(db);
  const status = requiresReview ? "pending_review" : "published";
  await db
    .update(chapters)
    .set({ status, published_at: status === "published" ? new Date() : null, rejection_reason: null })
    .where(and(eq(chapters.id, chapterId), eq(chapters.status, "draft")));
}
