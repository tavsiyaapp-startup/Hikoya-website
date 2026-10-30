import "server-only";
import { and, asc, desc, eq, gt, lt, max, sql } from "drizzle-orm";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  canAddChapter,
  canEditChapter,
  canSubmitChapterForReview,
  canViewChapter,
  isStaff,
  type ChapterRecord,
  type Viewer,
} from "@/server/authz/policy";
import type { DbOrTx } from "@/server/db/client";
import { chapters, stories } from "@/server/db/schema";
import { ChapterTooLongError, ForbiddenError, NotFoundError } from "@/server/data/errors";
import { getStoryRecord } from "@/server/data/stories";
import { getRequiresReview } from "@/server/data/settings";
import { computeChapterStatus, nextOrderIndex, wordCount } from "@/server/data/logic";
import { MAX_CHAPTER_WORDS } from "@/lib/constants";

// Upper bounds well above any real chapter (a whole novel is ~1-2 MB of
// text); without them one request could store tens of megabytes per field.
const MAX_CHAPTER_TITLE = 200;
const MAX_CHAPTER_CONTENT = 2_000_000;

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
// asDraft: saved but not published — used when «Obuna» says the author needs
// a subscription to publish (src/lib/actions/stories.ts).
export async function addChapter(
  db: DbOrTx,
  viewer: Viewer | null,
  storyId: string,
  input: ChapterInput,
  options: { asDraft?: boolean } = {}
) {
  const title = input.title.trim();
  const content = sanitizeHtml(input.content.trim());
  if (!title || !content) throw new Error("Title and content are required");
  if (title.length > MAX_CHAPTER_TITLE || content.length > MAX_CHAPTER_CONTENT) throw new Error("Chapter too long");
  // A brand-new chapter over the word limit is refused outright.
  if (wordCount(content) > MAX_CHAPTER_WORDS) throw new ChapterTooLongError();

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
    const status = options.asDraft ? ("draft" as const) : computeChapterStatus(requiresReview);

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

// Returns the chapter's status so the caller can tell moderators when an
// already-approved chapter was changed.
// When pre-moderation is on, an author's edit of an already-approved chapter
// sends it back to review (it leaves public view until approved again) —
// otherwise clean text could be approved and then swapped for anything.
// Staff edits keep the status.
export async function updateChapter(db: DbOrTx, viewer: Viewer | null, chapterId: string, input: ChapterInput) {
  const { chapter } = await requireEditableChapter(db, viewer, chapterId);
  const title = input.title.trim();
  const content = sanitizeHtml(input.content.trim());
  if (!title || !content) throw new Error("Title and content are required");
  if (title.length > MAX_CHAPTER_TITLE || content.length > MAX_CHAPTER_CONTENT) throw new Error("Chapter too long");
  // Word limit, but grandfathered: a chapter that was already over the limit
  // (saved before it existed) stays editable — the limit only blocks pushing
  // a within-limit chapter over it, so existing works aren't broken.
  if (wordCount(content) > MAX_CHAPTER_WORDS) {
    const [cur] = await db.select({ wc: chapters.word_count }).from(chapters).where(eq(chapters.id, chapter.id)).limit(1);
    if ((cur?.wc ?? 0) <= MAX_CHAPTER_WORDS) throw new ChapterTooLongError();
  }

  const backToReview = chapter.status === "published" && !isStaff(viewer) && (await getRequiresReview(db));
  await db
    .update(chapters)
    .set({
      title,
      content,
      word_count: wordCount(content),
      updated_at: new Date(),
      ...(backToReview ? { status: "pending_review" as const } : {}),
    })
    .where(eq(chapters.id, chapter.id));
  return { status: backToReview ? ("pending_review" as const) : chapter.status, wentBackToReview: backToReview };
}

// Move a chapter one place up or down by swapping its order_index with its
// neighbour's. Author (or staff) only, via requireEditableChapter. The story
// row is locked for the swap so a concurrent add/delete/move can't interleave,
// and the two rows swap through a temporary -1 (real order_index starts at 1)
// to never collide on unique(story_id, order_index) mid-update.
export async function moveChapter(
  db: DbOrTx,
  viewer: Viewer | null,
  chapterId: string,
  direction: "up" | "down"
): Promise<boolean> {
  const { chapter } = await requireEditableChapter(db, viewer, chapterId);
  return db.transaction(async (tx) => {
    await tx.select({ id: stories.id }).from(stories).where(eq(stories.id, chapter.story_id)).for("update");

    const [cur] = await tx
      .select({ id: chapters.id, order_index: chapters.order_index })
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .limit(1);
    if (!cur) return false;

    const neighbourWhere =
      direction === "up"
        ? and(eq(chapters.story_id, chapter.story_id), lt(chapters.order_index, cur.order_index))
        : and(eq(chapters.story_id, chapter.story_id), gt(chapters.order_index, cur.order_index));
    const [neighbour] = await tx
      .select({ id: chapters.id, order_index: chapters.order_index })
      .from(chapters)
      .where(neighbourWhere)
      .orderBy(direction === "up" ? desc(chapters.order_index) : asc(chapters.order_index))
      .limit(1);
    // Already at the top/bottom — nothing to swap with.
    if (!neighbour) return false;

    await tx.update(chapters).set({ order_index: -1 }).where(eq(chapters.id, cur.id));
    await tx.update(chapters).set({ order_index: cur.order_index }).where(eq(chapters.id, neighbour.id));
    await tx.update(chapters).set({ order_index: neighbour.order_index }).where(eq(chapters.id, cur.id));
    return true;
  });
}

// The reorder after a delete was previously a loop of one UPDATE per chapter
// (backend_functions.md finding 10) — here it is one statement.
export async function deleteChapter(db: DbOrTx, viewer: Viewer | null, chapterId: string): Promise<void> {
  const { chapter } = await requireEditableChapter(db, viewer, chapterId);

  await db.transaction(async (tx) => {
    // Same story-row lock addChapter takes, so a concurrent add can't pick
    // an order_index while the renumber below is in flight.
    await tx.select({ id: stories.id }).from(stories).where(eq(stories.id, chapter.story_id)).for("update");

    const [deleted] = await tx.delete(chapters).where(eq(chapters.id, chapterId)).returning({ order_index: chapters.order_index });
    if (!deleted) return;
    // Two steps because unique(story_id, order_index) is not deferrable and
    // Postgres checks it row by row: a single "order_index - 1" can collide
    // with a not-yet-shifted neighbour (23505) depending on physical row
    // order, rolling back the whole delete. Negating first moves every
    // affected row out of the positive range, then they land on their final
    // values with no overlap possible.
    const after = and(eq(chapters.story_id, chapter.story_id), gt(chapters.order_index, deleted.order_index));
    await tx.update(chapters).set({ order_index: sql`-${chapters.order_index}` }).where(after);
    await tx
      .update(chapters)
      .set({ order_index: sql`-${chapters.order_index} - 1` })
      .where(and(eq(chapters.story_id, chapter.story_id), sql`${chapters.order_index} < 0`));
  });
}

export async function submitChapterForReview(db: DbOrTx, viewer: Viewer | null, chapterId: string): Promise<void> {
  const chapter = await getChapterRecord(db, chapterId);
  if (!chapter) throw new NotFoundError("Chapter");
  const story = await getStoryRecord(db, chapter.story_id);
  if (!story) throw new NotFoundError("Chapter");
  if (!canSubmitChapterForReview(viewer, chapter, story)) throw new ForbiddenError();

  // A chapter staff rejected goes back through review even with
  // pre-moderation off (same rule as submitStoryForReview).
  const [row] = await db
    .select({ rejection_reason: chapters.rejection_reason })
    .from(chapters)
    .where(eq(chapters.id, chapterId))
    .limit(1);
  const requiresReview = (await getRequiresReview(db)) || Boolean(row?.rejection_reason);
  const status = requiresReview ? "pending_review" : "published";
  await db
    .update(chapters)
    // A chapter that was published before (then rejected) keeps its first
    // publication date.
    .set({
      status,
      ...(status === "published" ? { published_at: sql`coalesce(${chapters.published_at}, now())` } : {}),
      rejection_reason: null,
    })
    .where(and(eq(chapters.id, chapterId), eq(chapters.status, "draft")));
}
