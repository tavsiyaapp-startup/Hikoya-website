import { readUpload } from "@/server/storage/local";

// Serves user uploads (covers, avatars, chapter and banner images) from
// public/uploads/ on every request. `next start` only serves public/ files
// that existed when the server started, so a freshly uploaded cover was a
// broken image until the next restart. Files that were already there at
// startup are still served by Next's static handler before this runs.
// next.config.ts adds the strict Content-Security-Policy for /uploads/*.
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const file = await readUpload(path.join("/"));
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      // File names are unique per upload and never rewritten.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
