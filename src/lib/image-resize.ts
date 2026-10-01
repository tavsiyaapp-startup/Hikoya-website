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

export async function resizeImageFile(file: File, { maxWidth, maxHeight, quality = 0.85 }: ResizeOptions): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  if (scale >= 1) {
    bitmap.close();
    return file;
  }

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}
