// Client-only: downscales/recompresses an image File in the browser before
// upload. next.config.ts serves Supabase Storage images `unoptimized` (this
// host's 500MB RAM makes on-the-fly sharp transforms risky), so whatever
// gets uploaded here is exactly what every card/carousel/grid re-downloads
// at full size on every view — a phone-camera-resolution cover shown as a
// 120px-wide thumbnail was the actual driver behind Supabase's egress quota
// getting blown through by a user base of a couple hundred people. Images
// already within bounds pass through untouched (never upscaled, never
// re-encoded when there's nothing to gain); non-image files and GIFs
// (animation would be lost on a single-frame re-encode) pass through too.

export interface ResizeOptions {
  maxWidth: number;
  maxHeight: number;
  quality?: number; // 0-1, JPEG quality
}

// iPhones shoot HEIC/HEIF by default and non-Apple browsers can't decode it,
// so such a file would reach the server unconverted and be rejected as an
// unsupported format (the server only accepts jpeg/png/gif/webp). Detect it by
// MIME type or filename and convert to JPEG first.
function isHeic(file: File): boolean {
  return file.type === "image/heic" || file.type === "image/heif" || /\.(heic|heif)$/i.test(file.name);
}

// heic2any bundles a ~2.7 MB libheif/wasm decoder, so it's imported lazily —
// only when a HEIC file is actually picked — and never weighs on the main
// bundle or on anyone uploading an ordinary JPEG/PNG.
async function heicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(out) ? out[0] : out;
  const name = file.name.replace(/\.(heic|heif)$/i, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

export async function resizeImageFile(file: File, { maxWidth, maxHeight, quality = 0.85 }: ResizeOptions): Promise<File> {
  // Convert HEIC/HEIF up front; if conversion fails, fall through with the
  // original (Safari may still decode it below, otherwise the server rejects
  // it with a clear "unsupported format" message).
  let working = file;
  if (isHeic(file)) {
    working = await heicToJpeg(file).catch(() => file);
  }

  if (!working.type.startsWith("image/") || working.type === "image/gif") return working;

  const bitmap = await createImageBitmap(working).catch(() => null);
  if (!bitmap) return working;

  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  if (scale >= 1) {
    bitmap.close();
    return working;
  }

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return working;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) return working;

  const newName = working.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}
