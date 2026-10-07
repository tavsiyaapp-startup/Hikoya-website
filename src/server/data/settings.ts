import "server-only";
import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/client";
import { platformSettings } from "@/server/db/schema";

export async function getRequiresReview(db: DbOrTx): Promise<boolean> {
  const [row] = await db
    .select({ value: platformSettings.new_story_requires_review })
    .from(platformSettings)
    .where(eq(platformSettings.id, 1))
    .limit(1);
  return row?.value ?? false;
}
