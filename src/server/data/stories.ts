import "server-only";
import { and, eq, inArray } from "drizzle-orm";
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
import { ForbiddenError, NotFoundError } from "@/server/data/errors";
import { getRequiresReview } from "@/server/data/settings";
import { computeStoryStatus, sanitizeNewTagLabels, wordCount } from "@/server/data/logic";

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

  const existing = await tx.select({ id: tags.id, label_ru: tags.label_ru }).from(tags).where(inArray(tags.label_ru, clean));
  const found = new Set(existing.map((t) => t.label_ru));
  const ids = existing.map((t) => t.id);

  const missing = clean.filter((label) => !found.has(label));
  if (missing.length > 0) {
    const created = await tx
      .insert(tags)
      .values(missing.map((label) => ({ category: "style" as const, label_ru: label, label_uz: label })))
      .onConflictDoNothing({ target: [tags.category, tags.label_ru] })
      .returning({ id: tags.id });
    ids.push(...created.map((t) => t.id));
  }
  return ids;
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

  const requiresReview = await getRequiresReview(db);
  const status = requiresReview ? "pending_review" : "published";
  await db
    .update(stories)
    .set({ status, published_at: status === "published" ? new Date() : null, rejection_reason: null })
    .where(eq(stories.id, storyId));
}
