import "server-only";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { sanitizeHtml } from "@/lib/sanitize";
import { slugify, withRandomSuffix } from "@/lib/slug";
import type { AgeRating, StoryProgressStatus, StoryVisibility } from "@/types/database";
import {
  canDeleteStory,
  canEditStory,
  canSubmitStoryForReview,
  canViewStory,
  type StoryRecord,
  type Viewer,
} from "@/server/authz/policy";
import type { DbOrTx } from "@/server/db/client";
import { chapters, profiles, stories, storyTags, tags } from "@/server/db/schema";
import { ChapterTooLongError, ForbiddenError, NotFoundError } from "@/server/data/errors";
import { getRequiresReview } from "@/server/data/settings";
import { computeStoryStatus, sanitizeNewTagLabels, wordCount } from "@/server/data/logic";
import { MAX_CHAPTER_WORDS } from "@/lib/constants";

const storyRecordColumns = {
  id: stories.id,
  author_id: stories.author_id,
  status: stories.status,
  visibility: stories.visibility,
  deleted_at: stories.deleted_at,
} as const;

export async function getStoryRecord(db: DbOrTx, storyId: string): Promise<StoryRecord | null> {
  const [row] = await db.select(storyRecordColumns).from(stories).where(eq(stories.id, storyId)).limit(1);
  return row ?? null;
}

// Throws the same error whether the story is missing or just not visible to
// this viewer — telling the two apart from the outside would leak which
// draft/private ids exist.
export async function requireViewableStory(db: DbOrTx, viewer: Viewer | null, storyId: string): Promise<StoryRecord> {
  const story = await getStoryRecord(db, storyId);
  if (!story || !canViewStory(viewer, story)) throw new NotFoundError("Story");
  return story;
}

async function requireEditableStory(db: DbOrTx, viewer: Viewer | null, storyId: string): Promise<StoryRecord> {
  const story = await getStoryRecord(db, storyId);
  if (!story) throw new NotFoundError("Story");
  if (!canEditStory(viewer, story)) throw new ForbiddenError();
  return story;
}

// Supabase's "tags" RLS let only staff write, but the code this replaces
// (resolveTagIds in lib/actions/stories.ts) always wrote through the
// service-role client — see backend_functions.md finding 4. The limit on
// how many new tags one story can introduce was never actually enforced;
// it is now, in sanitizeNewTagLabels.
async function resolveTagIds(tx: DbOrTx, labels: string[]): Promise<string[]> {
  const clean = sanitizeNewTagLabels(labels);
  if (clean.length === 0) return [];

  // Case-insensitive match so "Романтика" reuses an existing "романтика"
  // tag instead of creating a near-duplicate row.
  const existing = await tx
    .select({ id: tags.id, label_ru: tags.label_ru })
    .from(tags)
    .where(inArray(sql`lower(${tags.label_ru})`, clean.map((l) => l.toLowerCase())));
  const foundLower = new Set(existing.map((t) => t.label_ru.toLowerCase()));
  const ids = existing.map((t) => t.id);

  const missing = clean.filter((label) => !foundLower.has(label.toLowerCase()));
  if (missing.length > 0) {
    const created = await tx
      .insert(tags)
      .values(missing.map((label) => ({ category: "style" as const, label_ru: label, label_uz: label })))
      .onConflictDoNothing({ target: [tags.category, tags.label_ru] })
      .returning({ id: tags.id, label_ru: tags.label_ru });
    ids.push(...created.map((t) => t.id));
    // A tag another author created at the same moment hits the conflict and
    // isn't returned above — read those back instead of silently dropping
    // the tag from this story.
    const createdLabels = new Set(created.map((t) => t.label_ru));
    const raced = missing.filter((label) => !createdLabels.has(label));
    if (raced.length > 0) {
      const rows = await tx
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.category, "style"), inArray(tags.label_ru, raced)));
      ids.push(...rows.map((t) => t.id));
    }
  }
  return ids;
}

// Upper bounds far above any real story card; without them one request could
// store megabytes in a title, or thousands of genres. Tags are bounded
// separately in sanitizeNewTagLabels.
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 5000;
const MAX_ANNOUNCE = 1000;
const MAX_GENRES = 10;
const MAX_SHORT_LABEL = 40; // one genre, relationship type, language
const MAX_CHAPTER_TITLE = 200;
const MAX_CHAPTER_CONTENT = 2_000_000;

function assertStoryLimits(input: {
  title: string;
  description: string;
  genres: string[];
  relationshipType: string | null;
  language?: string;
  announce?: string | null;
}) {
  const tooLong =
    input.title.length > MAX_TITLE ||
    input.description.length > MAX_DESCRIPTION ||
    (input.announce?.length ?? 0) > MAX_ANNOUNCE ||
    input.genres.length > MAX_GENRES ||
    input.genres.some((g) => g.length > MAX_SHORT_LABEL) ||
    (input.relationshipType?.length ?? 0) > MAX_SHORT_LABEL ||
    (input.language?.length ?? 0) > MAX_SHORT_LABEL;
  if (tooLong) throw new Error("Story field too long");
}

export interface CreateStoryInput {
  title: string;
  description: string;
  coverUrl: string | null;
  genres: string[];
  relationshipType: string | null;
  tagLabels: string[];
  language: string;
  ageRating: AgeRating;
  isTranslation: boolean;
  chapterTitle: string;
  chapterText: string;
  visibility: StoryVisibility;
  announce: string | null;
}

export async function createStory(db: DbOrTx, viewer: Viewer | null, input: CreateStoryInput) {
  if (!viewer || viewer.status !== "active") throw new ForbiddenError();
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");
  assertStoryLimits({ ...input, title, language: input.language.trim() });
  if (input.chapterTitle.length > MAX_CHAPTER_TITLE || input.chapterText.length > MAX_CHAPTER_CONTENT) {
    throw new Error("Chapter too long");
  }

  return db.transaction(async (tx) => {
    const requiresReview = await getRequiresReview(tx);
    // The first chapter shares the story's status exactly (draft stays
    // draft, otherwise both go through review together) — computeStoryStatus
    // never actually returns "unlisted", only the subset that is also a
    // valid ChapterStatus; see its return type.
    const status = computeStoryStatus(input.visibility, requiresReview);
    const slug = withRandomSuffix(slugify(title));
    const language = input.language.trim() || "ru";
    const chapterContent = sanitizeHtml(input.chapterText);
    // The story's first chapter is a new chapter — same word limit as any other.
    if (wordCount(chapterContent) > MAX_CHAPTER_WORDS) throw new ChapterTooLongError();

    const [story] = await tx
      .insert(stories)
      .values({
        author_id: viewer.id,
        title,
        slug,
        description: input.description,
        cover_url: input.coverUrl,
        genres: [...new Set(input.genres)],
        relationship_type: input.relationshipType,
        language,
        age_rating: input.ageRating,
        is_translation: input.isTranslation,
        status,
        visibility: input.visibility,
        announce: input.announce,
        published_at: status === "published" ? new Date() : null,
      })
      .returning({ id: stories.id, slug: stories.slug });

    await tx.insert(chapters).values({
      story_id: story.id,
      order_index: 1,
      title: input.chapterTitle,
      content: chapterContent,
      word_count: wordCount(chapterContent),
      status,
      is_free: true,
      published_at: status === "published" ? new Date() : null,
    });

    const tagIds = await resolveTagIds(tx, input.tagLabels);
    if (tagIds.length > 0) {
      await tx.insert(storyTags).values(tagIds.map((tagId) => ({ story_id: story.id, tag_id: tagId })));
    }

    // A first story moves a reader into the author role. Scoped to role =
    // 'reader' so it can never downgrade an author/moderator/admin.
    await tx.update(profiles).set({ role: "author" }).where(and(eq(profiles.id, viewer.id), eq(profiles.role, "reader")));

    return { id: story.id, slug: story.slug, status };
  });
}

export interface UpdateStoryInput {
  title: string;
  description: string;
  coverUrl: string | null;
  genres: string[];
  relationshipType: string | null;
  tagLabels: string[];
  progressStatus: StoryProgressStatus;
  isTranslation: boolean;
}

export async function updateStory(db: DbOrTx, viewer: Viewer | null, storyId: string, input: UpdateStoryInput) {
  await requireEditableStory(db, viewer, storyId);
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");
  assertStoryLimits({ ...input, title });

  await db.transaction(async (tx) => {
    await tx
      .update(stories)
      .set({
        title,
        description: input.description,
        cover_url: input.coverUrl,
        genres: [...new Set(input.genres)],
        relationship_type: input.relationshipType,
        progress_status: input.progressStatus,
        is_translation: input.isTranslation,
        updated_at: new Date(),
      })
      .where(eq(stories.id, storyId));

    await tx.delete(storyTags).where(eq(storyTags.story_id, storyId));
    const tagIds = await resolveTagIds(tx, input.tagLabels);
    if (tagIds.length > 0) {
      await tx.insert(storyTags).values(tagIds.map((tagId) => ({ story_id: storyId, tag_id: tagId })));
    }
  });
}

export async function deleteStory(db: DbOrTx, viewer: Viewer | null, storyId: string): Promise<void> {
  const story = await getStoryRecord(db, storyId);
  if (!story) throw new NotFoundError("Story");
  if (!canDeleteStory(viewer, story)) throw new ForbiddenError();
  await db.update(stories).set({ status: "draft", deleted_at: new Date() }).where(eq(stories.id, storyId));
}

export async function submitStoryForReview(db: DbOrTx, viewer: Viewer | null, storyId: string): Promise<void> {
  const story = await getStoryRecord(db, storyId);
  if (!story) throw new NotFoundError("Story");
  if (!canSubmitStoryForReview(viewer, story)) throw new ForbiddenError();

  // rejection_reason is set when staff rejected or hid the story — then it
  // goes back to the moderation queue even when pre-moderation is off, so an
  // author can't undo a takedown with one click. A story created as a
  // private draft becomes public when it's published.
  const [row] = await db
    .select({ rejection_reason: stories.rejection_reason })
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);
  const requiresReview = (await getRequiresReview(db)) || Boolean(row?.rejection_reason);
  const status = requiresReview ? "pending_review" : "published";
  const [submitted] = await db
    .update(stories)
    .set({
      status,
      // The first publication date is kept for good: a story rejected or
      // hidden and then resubmitted keeps the date it first went live.
      ...(status === "published" ? { published_at: sql`coalesce(${stories.published_at}, now())` } : {}),
      rejection_reason: null,
      ...(story.visibility === "draft" ? { visibility: "public" as const } : {}),
    })
    .where(and(eq(stories.id, storyId), eq(stories.status, "draft"), isNull(stories.deleted_at)))
    .returning({ id: stories.id });
  if (!submitted) return;

  // Chapters rejected earlier (draft with a reason) go back to the queue with
  // the story, so the moderator sees them and approving the story publishes
  // them too — the author no longer has to resubmit each chapter. Their own
  // unsubmitted drafts (no reason) stay drafts.
  if (status === "pending_review") {
    await db
      .update(chapters)
      .set({ status: "pending_review" })
      .where(and(eq(chapters.story_id, storyId), eq(chapters.status, "draft"), isNotNull(chapters.rejection_reason)));
  }
}
