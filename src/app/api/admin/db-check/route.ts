import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getStaffSession } from "@/server/auth/staff";
import { getDb } from "@/server/db/client";
import { profiles, stories } from "@/server/db/schema";

// Temporary, staff-only: the first real check that the deployed app can
// reach the new PostgreSQL database (DATABASE_URL) over the self-hosted
// connection — everything before this was checked by parsing/typechecking,
// never a live connection. Staff-gated the same way as
// src/app/api/admin/stories/[id]/download/route.ts, since that route sits
// outside the /admin layout's own gating. Delete this file once the
// connection is confirmed working; it has no reason to stay.
export async function GET() {
  const result = await getStaffSession();
  if (result.status !== "staff") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const db = getDb();
    const version = await db.execute(sql`select version()`);
    const [{ count: profileCount }] = await db.select({ count: sql<number>`count(*)` }).from(profiles);
    const [{ count: storyCount }] = await db.select({ count: sql<number>`count(*)` }).from(stories);
    return NextResponse.json({
      ok: true,
      version: version.rows[0]?.version,
      profileCount,
      storyCount,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
