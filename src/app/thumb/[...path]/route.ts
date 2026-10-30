import { readUpload, readUploadThumb } from "@/server/storage/local";

// Card-sized cover thumbnails. Separate from /uploads on purpose: files in
// public/uploads are served directly by nginx/Next's static handler (which
// ignores the ?w query and sends them with Cache-Control: max-age=0), so a
// thumbnail request to /uploads never reaches a resizer and never gets a
// long cache. /thumb matches no file on disk, so it always runs here — we
// resize to a cached WebP and set an immutable one-year cache. Falls back to
// the full original when the size isn't allowed or the image is a GIF.
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = path.join("/");
  const width = Number(new URL(request.url).searchParams.get("w")) || 360;
  const file = (await readUploadThumb(rel, width)) ?? (await readUpload(rel));
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      // Thumbnails are derived from immutable, uniquely-named uploads and the
      // width is in the URL, so a given URL never changes.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
    },
  });
}
