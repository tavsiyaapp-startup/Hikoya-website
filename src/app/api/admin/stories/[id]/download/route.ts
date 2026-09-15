import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getStoryForModeration, getChaptersForDownload } from "@/lib/queries/admin";
import { buildStoryDocx } from "@/lib/docx/exportStory";

// A chapter-image-heavy story (each <img> is fetched from Storage before
// being embedded, see src/lib/docx/htmlToDocx.ts) measured over 10s to
// build — past Vercel's default serverless timeout (10s on Hobby), which
// kills the function mid-request with no useful error, reading to the
// admin as "download just doesn't happen" past a handful of stories. 60s
// is the max Hobby allows anyway; Vercel silently caps this to whatever the
// actual plan allows, so it's safe to just ask for the ceiling.
export const maxDuration = 60;

// Staff-only .docx export of a story's current chapters — same "admin or
// moderator" gate as the rest of /admin (src/app/admin/layout.tsx), checked
// again here since route handlers sit outside that layout's own gating.
// Generated fresh on every request (no caching): whatever chapters exist in
// the DB right now is exactly what comes back, so a chapter published five
// minutes ago is already in the next download.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  const isStaff = user?.profile && ["admin", "moderator"].includes(user.profile.role);
  if (!isStaff) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [story, chapters] = await Promise.all([getStoryForModeration(id), getChaptersForDownload(id)]);
  if (!story) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let buffer: Buffer;
  try {
    buffer = await buildStoryDocx(story.title, story.author?.display_name ?? "", chapters);
  } catch (err) {
    console.error(`[admin story download] failed for story ${id}:`, err);
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }

  const filename = `${sanitizeFilename(story.title) || "story"}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

function sanitizeFilename(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 80);
}
