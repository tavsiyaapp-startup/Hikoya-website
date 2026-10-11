"use server";

import mammoth from "mammoth";
import { headers } from "next/headers";
import { getAuth } from "@/server/auth/config";
import { saveUploadBuffer } from "@/server/storage/local";
import { sanitizeHtml } from "@/lib/sanitize";

// Identity comes from Better Auth now, not Supabase. Images embedded in the
// uploaded .docx now land in the same local public/uploads/chapter-images/
// storage every other chapter image upload uses (see
// src/server/storage/local.ts) instead of Supabase Storage — the last
// Supabase dependency this file had.
export async function convertDocxToHtml(formData: FormData): Promise<{ html: string } | { error: string }> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  const userId = session?.user.id;
  if (!userId) return { error: "unauthorized" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "no_file" };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    const { value: html } = await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          const imageBuffer = await image.readAsBuffer();
          try {
            return { src: await saveUploadBuffer("chapter-images", userId, imageBuffer) };
          } catch {
            // Unsupported embedded format (EMF/WMF/SVG...) — dropped, same as a failed upload used to be.
            return { src: "" };
          }
        }),
      }
    );

    return { html: sanitizeHtml(html) };
  } catch {
    return { error: "convert_failed" };
  }
}
