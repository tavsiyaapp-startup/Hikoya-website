"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { updateStory } from "@/lib/actions/stories";
import { Textarea } from "@/components/ui/Textarea";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { TagPicker } from "@/components/story/TagPicker";

export function EditStoryForm({
  storyId,
  storySlug,
  authorId,
  initialCoverUrl,
  initialGenre,
  initialDescription,
  initialTags,
  existingTags,
}: {
  storyId: string;
  storySlug: string;
  authorId: string;
  initialCoverUrl: string | null;
  initialGenre: string;
  initialDescription: string;
  initialTags: string[];
  existingTags: string[];
}) {
  const { t } = useLocale();
  const [coverUrl, setCoverUrl] = useState<string | null>(initialCoverUrl);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [genre, setGenre] = useState(initialGenre);
  const [description, setDescription] = useState(initialDescription);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [pending, startTransition] = useTransition();

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    setCoverError(null);
    try {
      const supabase = createClient();
      const path = `${authorId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("covers").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("covers").getPublicUrl(path);
      setCoverUrl(data.publicUrl);
    } catch {
      setCoverError(t.create.coverError);
    } finally {
      setCoverUploading(false);
    }
  }

  function handleSave() {
    startTransition(() => {
      updateStory(storyId, storySlug, { description, coverUrl, genre, tags });
    });
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-4.5 sm:p-7.5">
      <h2 className="mb-1.5 text-[20px] font-extrabold">{t.manage.editStory}</h2>

      <div className="mt-5 flex flex-col items-start gap-5 sm:flex-row">
        <div className="relative h-45 w-full shrink-0 overflow-hidden rounded-2xl bg-primary-200 shadow-[0_10px_26px_rgba(60,40,120,0.16)] sm:w-34">
          {coverUrl && <Image src={coverUrl} alt="" fill className="object-cover" />}
        </div>
        <label className="flex h-40 w-full flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary-300 bg-surface text-center hover:bg-primary-50 sm:h-45">
          <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
          <span className="text-[14.5px] font-bold text-primary-800">
            {coverUploading ? t.common.loading : t.create.uploadCover}
          </span>
          <span className="text-[12.5px] text-muted-2">{t.create.coverRecommended}</span>
          {coverError && <span className="text-[12px] text-danger">{coverError}</span>}
        </label>
      </div>

      <label className="mb-2 mt-5 block text-[14px] font-bold">{t.create.descLabel}</label>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t.create.descPlaceholder}
        rows={4}
        className="mb-5"
      />

      <label className="mb-2 block text-[14px] font-bold">{t.create.genreLabel}</label>
      <div className="mb-5 flex flex-wrap gap-2">
        {t.genres.map((g) => (
          <Chip key={g} active={genre === g} onClick={() => setGenre(g)}>
            {g}
          </Chip>
        ))}
      </div>

      <label className="mb-2 block text-[14px] font-bold">
        {t.create.tagsLabel} <span className="font-medium text-muted-2">{t.create.tagsHint}</span>
      </label>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setTags((prev) => prev.filter((x) => x !== tag))}
            className="flex h-9 items-center gap-2 rounded-[10px] border border-primary-300 bg-primary-50 px-3 text-[13px] font-semibold text-primary-900"
          >
            <span>{tag}</span>
            <span className="text-[15px] leading-none">×</span>
          </button>
        ))}
        <TagPicker
          existingTags={existingTags}
          onAdd={(tag) => setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))}
        />
      </div>

      <Button onClick={handleSave} disabled={pending}>
        {pending ? t.common.loading : t.common.save}
      </Button>
    </div>
  );
}
