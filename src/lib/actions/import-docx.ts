"use server";

import mammoth from "mammoth";
import { headers } from "next/headers";
import { getAuth } from "@/server/auth/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeHtml } from "@/lib/sanitize";

// Identity comes from Better Auth now, not Supabase — only who's allowed to
// trigger this changed. The actual image upload below still goes through
// Supabase Storage via the service-role client, which never depended on a
// user's Supabase session in the first place (it's a static API key, not
// RLS-scoped), so it's unaffected either way; file storage itself is its
// own separate, still-pending migration piece.
export async function convertDocxToHtml(formData: FormData): Promise<{ html: string } | { error: string }> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  const userId = session?.user.id;
  if (!userId) return { error: "unauthorized" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "no_file" };

  const admin = createAdminClient();

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    const { value: html } = await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          const imageBuffer = await image.readAsBuffer();
          const extension = image.contentType.split("/")[1] ?? "png";
          const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
          const { error } = await admin.storage
            .from("chapter-images")
            .upload(path, imageBuffer, { contentType: image.contentType });
          if (error) return { src: "" };
          const { data } = admin.storage.from("chapter-images").getPublicUrl(path);
          return { src: data.publicUrl };
        }),
      }
    );

    return { html: sanitizeHtml(html) };
  } catch {
    return { error: "convert_failed" };
  }
}
