"use server";

import mammoth from "mammoth";
import { headers } from "next/headers";
import { getAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { loadViewer } from "@/server/data/viewer";
import { isActive } from "@/server/authz/policy";
import { takeRateLimit } from "@/server/rate-limit";
import { saveUploadBuffer, userUploadBytes, USER_UPLOAD_QUOTA_BYTES } from "@/server/storage/local";
import { sanitizeHtml } from "@/lib/sanitize";

// A .docx is a zip; mammoth unpacks it fully in memory, so both the upload
// size and the number of conversions per hour are capped well below what the
// server's memory can take (the Server Action body limit alone is 25 MB).
const MAX_DOCX_BYTES = 15 * 1024 * 1024;
const DOCX_IMPORTS_PER_HOUR = 10;
const MAX_IMAGES_PER_DOCX = 100;

// Identity comes from Better Auth now, not Supabase. Images embedded in the
// uploaded .docx now land in the same local public/uploads/chapter-images/
// storage every other chapter image upload uses (see
// src/server/storage/local.ts) instead of Supabase Storage — the last
// Supabase dependency this file had.
export async function convertDocxToHtml(formData: FormData): Promise<{ html: string } | { error: string }> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  const userId = session?.user.id;
  if (!userId) return { error: "unauthorized" };
  if (!isActive(await loadViewer(getDb(), userId))) return { error: "unauthorized" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "no_file" };
  if (file.size > MAX_DOCX_BYTES) return { error: "too_large" };
  if (!takeRateLimit(`docx:${userId}`, DOCX_IMPORTS_PER_HOUR, 60 * 60 * 1000)) return { error: "rate_limited" };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    let usedBytes = await userUploadBytes(userId);
    let imageCount = 0;
    let skippedImages = 0;

    const { value: html } = await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          imageCount += 1;
          if (imageCount > MAX_IMAGES_PER_DOCX) {
            skippedImages += 1;
            return { src: "" };
          }
          const imageBuffer = await image.readAsBuffer();
          if (usedBytes + imageBuffer.length > USER_UPLOAD_QUOTA_BYTES) {
            skippedImages += 1;
            return { src: "" };
          }
          try {
            const src = await saveUploadBuffer("chapter-images", userId, imageBuffer);
            usedBytes += imageBuffer.length;
            return { src };
          } catch {
            // Unsupported embedded format (EMF/WMF/SVG...) — dropped, same as a failed upload used to be.
            skippedImages += 1;
            return { src: "" };
          }
        }),
      }
    );

    if (skippedImages > 0) console.warn(`[import-docx] skipped ${skippedImages} image(s) for user ${userId}`);
    return { html: sanitizeHtml(html) };
  } catch (err) {
    console.error("[import-docx] conversion failed", err);
    return { error: "convert_failed" };
  }
}
