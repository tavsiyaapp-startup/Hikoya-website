"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getAuth } from "@/server/auth/config";
import { getDb, type DbOrTx } from "@/server/db/client";
import { collectionItems, collections, profiles, savedCollections } from "@/server/db/schema";
import { loadViewer } from "@/server/data/viewer";
import { canCreateCollection, canManageCollection, canSaveCollection, type CollectionRecord } from "@/server/authz/policy";
import { ROUTES } from "@/lib/constants";

// Identity comes from Better Auth now, not Supabase. Ownership checks that
// used to be enforced by RLS (see supabase/schema_reference.sql's
// collections/collection_items/saved_collections policies) are now explicit
// here via src/server/authz/policy.ts — toggleStoryInCollection in
// particular had NO app-level ownership check before (its own comment said
// so), relying entirely on RLS to silently no-op a foreign collectionId;
// that check is added below since RLS no longer exists at all.
async function requireViewer() {
  const db = getDb();
  const session = await getAuth().api.getSession({ headers: await headers() });
  const viewer = await loadViewer(db, session?.user.id);
  if (!viewer) redirect(ROUTES.onboarding);
  return { db, viewer };
}

async function getCollectionRecord(db: DbOrTx, collectionId: string): Promise<CollectionRecord | null> {
  const [row] = await db
    .select({ id: collections.id, owner_id: collections.owner_id, is_private: collections.is_private })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);
  return row ?? null;
}

async function ownerTypeFor(db: DbOrTx, userId: string): Promise<"author" | "user"> {
  const [row] = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  return row?.role === "author" ? "author" : "user";
}

export async function createCollection(formData: FormData) {
  const { db, viewer } = await requireViewer();
  if (!canCreateCollection(viewer)) return;

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const isPrivate = formData.get("isPrivate") === "on";
  if (!title) return;

  const ownerType = await ownerTypeFor(db, viewer.id);

  await db.insert(collections).values({
    owner_id: viewer.id,
    owner_type: ownerType,
    title,
    description: description || null,
    is_private: isPrivate,
  });

  updateTag("collections");
  revalidatePath(ROUTES.collections);
  revalidatePath(ROUTES.library);
}

// The "+ Создать подборку" row inside the story card's collection picker —
// creating a collection there means you obviously want *this* story in it,
// so it's added in the same round trip instead of dropping the user on
// /collections with the story they started from now nowhere in sight.
export async function createCollectionWithStory(
  storyId: string,
  title: string,
  path: string
): Promise<{ id: string; title: string } | { error: string }> {
  const { db, viewer } = await requireViewer();
  if (!canCreateCollection(viewer)) return { error: "failed" };

  const trimmed = title.trim();
  if (!trimmed) return { error: "empty_title" };

  const ownerType = await ownerTypeFor(db, viewer.id);

  const [collection] = await db
    .insert(collections)
    .values({ owner_id: viewer.id, owner_type: ownerType, title: trimmed })
    .returning({ id: collections.id, title: collections.title });
  if (!collection) return { error: "failed" };

  await db.insert(collectionItems).values({ collection_id: collection.id, story_id: storyId });

  updateTag("collections");
  revalidatePath(path);
  revalidatePath(ROUTES.collections);
  revalidatePath(ROUTES.library);

  return { id: collection.id, title: collection.title };
}

export async function updateCollection(collectionId: string, formData: FormData) {
  const { db, viewer } = await requireViewer();
  const collection = await getCollectionRecord(db, collectionId);
  if (!collection || !canManageCollection(viewer, collection)) return;

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const isPrivate = formData.get("isPrivate") === "on";
  if (!title) return;

  await db
    .update(collections)
    .set({ title, description: description || null, is_private: isPrivate })
    .where(eq(collections.id, collectionId));

  updateTag("collections");
  revalidatePath(ROUTES.collection(collectionId));
  revalidatePath(ROUTES.collections);
  revalidatePath(ROUTES.library);
}

export async function toggleSavedCollection(collectionId: string, path: string) {
  const { db, viewer } = await requireViewer();
  const collection = await getCollectionRecord(db, collectionId);
  if (!collection || !canSaveCollection(viewer, collection)) return;

  const [existing] = await db
    .select({ collection_id: savedCollections.collection_id })
    .from(savedCollections)
    .where(and(eq(savedCollections.user_id, viewer.id), eq(savedCollections.collection_id, collectionId)))
    .limit(1);

  if (existing) {
    await db
      .delete(savedCollections)
      .where(and(eq(savedCollections.user_id, viewer.id), eq(savedCollections.collection_id, collectionId)));
  } else {
    await db.insert(savedCollections).values({ user_id: viewer.id, collection_id: collectionId });
  }

  revalidatePath(path);
  revalidatePath(ROUTES.collections);
}

export async function toggleStoryInCollection(collectionId: string, storyId: string, path: string) {
  const { db, viewer } = await requireViewer();
  const collection = await getCollectionRecord(db, collectionId);
  if (!collection || !canManageCollection(viewer, collection)) return;

  const [existing] = await db
    .select({ story_id: collectionItems.story_id })
    .from(collectionItems)
    .where(and(eq(collectionItems.collection_id, collectionId), eq(collectionItems.story_id, storyId)))
    .limit(1);

  if (existing) {
    await db
      .delete(collectionItems)
      .where(and(eq(collectionItems.collection_id, collectionId), eq(collectionItems.story_id, storyId)));
  } else {
    await db.insert(collectionItems).values({ collection_id: collectionId, story_id: storyId });
  }

  updateTag("collections");
  revalidatePath(path);
  revalidatePath(ROUTES.library);
}
