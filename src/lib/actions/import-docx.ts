"use server";

import mammoth from "mammoth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeHtml } from "@/lib/sanitize";

export async function convertDocxToHtml(formData: FormData): Promise<{ html: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };

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
          const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
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
