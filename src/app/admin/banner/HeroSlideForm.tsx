"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { createHeroSlide } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

export function HeroSlideForm() {
  const { t } = useLocale();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
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
      const { error } = await supabase.storage.from("hero-slides").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("hero-slides").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch {
      setError(t.create.coverError);
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(formData: FormData) {
    if (!imageUrl) {
      setError(t.admin.bannerImageRequired);
      return;
    }
    startTransition(async () => {
      await createHeroSlide(formData);
      setImageUrl(null);
      setError(null);
      setFormKey((k) => k + 1);
    });
  }

  return (
    <form key={formKey} action={handleSubmit} className="flex flex-col gap-3.5 rounded-2xl border border-border bg-surface p-4.5">
      <div>
        <label className="mb-1.5 block text-[13px] font-bold">{t.admin.bannerImageLabel}</label>
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
        </div>
        {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">{t.admin.bannerTitleRu}</label>
          <Input name="titleRu" required />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">{t.admin.bannerTitleUz}</label>
          <Input name="titleUz" required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">{t.admin.bannerBodyRu}</label>
          <Textarea name="bodyRu" rows={2} required />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">{t.admin.bannerBodyUz}</label>
          <Textarea name="bodyUz" rows={2} required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">
            {t.admin.bannerCtaLabelRu} <span className="font-medium text-muted-2">{t.admin.bannerOptional}</span>
          </label>
          <Input name="ctaLabelRu" />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">
            {t.admin.bannerCtaLabelUz} <span className="font-medium text-muted-2">{t.admin.bannerOptional}</span>
          </label>
          <Input name="ctaLabelUz" />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">
            {t.admin.bannerCtaUrl} <span className="font-medium text-muted-2">{t.admin.bannerOptional}</span>
          </label>
          <Input name="ctaUrl" placeholder="/search" />
        </div>
      </div>

      <input type="hidden" name="imageUrl" value={imageUrl ?? ""} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t.common.loading : t.admin.bannerAddSlide}
      </Button>
    </form>
  );
}
