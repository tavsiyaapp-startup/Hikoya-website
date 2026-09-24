"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { createAnnouncement, updateAnnouncement } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import type { Announcement } from "@/types/database";

export function AnnouncementForm({ announcement, onDone }: { announcement?: Announcement; onDone?: () => void }) {
  const { t } = useLocale();
  const [imageUrl, setImageUrl] = useState<string | null>(announcement?.image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const path = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("announcements").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("announcements").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch (err) {
      console.error("announcement image upload failed:", err);
      const detail = err instanceof Error ? err.message : String(err);
      setError(`${t.create.coverError} (${detail})`);
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(formData: FormData) {
    const hasText = ["textRu", "textUz"].some((k) => String(formData.get(k) ?? "").trim());
    if (!imageUrl && !hasText) {
      setError(t.admin.announcementRequired);
      return;
    }
    startTransition(async () => {
      if (announcement) {
        await updateAnnouncement(announcement.id, formData);
        onDone?.();
      } else {
        await createAnnouncement(formData);
        setImageUrl(null);
        setError(null);
        setFormKey((k) => k + 1);
      }
    });
  }

  return (
    <form
      key={formKey}
      action={handleSubmit}
      className="flex flex-col gap-3.5 rounded-[12px] border border-border bg-surface p-4.5"
    >
      <div>
        <label className="mb-1.5 block text-[13px] font-bold">{t.admin.announcementImageLabel}</label>
        <div className="flex items-center gap-3.5">
          {imageUrl && (
            <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-[10px] bg-primary-200">
              <Image src={imageUrl} alt="" fill className="object-cover" />
            </div>
          )}
          <label className="cursor-pointer text-[13px] font-bold text-primary-800">
            {uploading ? t.common.loading : t.create.uploadCover}
            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </label>
          {imageUrl && (
            <button
              type="button"
              onClick={() => setImageUrl(null)}
              className="cursor-pointer text-[12.5px] font-bold text-muted-2 hover:text-danger"
            >
              {t.admin.delete}
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">{t.admin.announcementTextRu}</label>
          <Textarea name="textRu" rows={2} defaultValue={announcement?.text_ru ?? ""} />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">{t.admin.announcementTextUz}</label>
          <Textarea name="textUz" rows={2} defaultValue={announcement?.text_uz ?? ""} />
        </div>
      </div>

      <input type="hidden" name="imageUrl" value={imageUrl ?? ""} />
      <div className="flex gap-2.5">
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? t.common.loading : announcement ? t.common.save : t.admin.announcementAdd}
        </Button>
        {announcement && (
          <button
            type="button"
            onClick={onDone}
            className="h-11 cursor-pointer self-start rounded-xl px-4 text-[14px] font-bold text-muted-2 hover:text-ink"
          >
            {t.common.cancel}
          </button>
        )}
      </div>
    </form>
  );
}
