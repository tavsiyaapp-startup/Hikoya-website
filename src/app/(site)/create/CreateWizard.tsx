"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { createStory, addChapter } from "@/lib/actions/stories";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Chip } from "@/components/ui/Chip";
import { TagPicker } from "@/components/story/TagPicker";
import { DocxImportFlow } from "@/components/manage/DocxImportFlow";
import { ROUTES } from "@/lib/constants";
import { RELATIONSHIP_TYPES } from "@/lib/relationshipTypes";
import type { SplitChapter } from "@/lib/editor/splitChapters";
import type { AgeRating, ContentLanguage, StoryVisibility } from "@/types/database";

export function CreateWizard({ userId, existingTags }: { userId: string; existingTags: string[] }) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState(t.genres[0]);
  const [relationshipType, setRelationshipType] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [language, setLanguage] = useState<ContentLanguage>("ru");
  const [ageRating, setAgeRating] = useState<AgeRating>("0+");

  const [chapterMode, setChapterMode] = useState<"manual" | "import">("manual");
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterText, setChapterText] = useState("");
  const [importedChapters, setImportedChapters] = useState<SplitChapter[]>([]);

  const [visibility, setVisibility] = useState<StoryVisibility>("public");
  const [announce, setAnnounce] = useState("");

  const [pending, startTransition] = useTransition();

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    setCoverError(null);
    try {
      const supabase = createClient();
      const path = `${userId}/${Date.now()}-${file.name}`;
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

  const step1Valid = title.trim().length > 0 && description.trim().length > 0;
  const step2Valid =
    chapterMode === "manual"
      ? chapterTitle.trim().length > 0 && chapterText.trim().length > 0
      : importedChapters.length > 0 && importedChapters.every((c) => c.title.trim().length > 0);

  function handlePublish() {
    startTransition(async () => {
      const firstChapter =
        chapterMode === "manual"
          ? { title: chapterTitle, text: chapterText }
          : { title: importedChapters[0].title, text: importedChapters[0].html };

      const story = await createStory({
        title,
        description,
        coverUrl,
        genre,
        relationshipType,
        tags,
        language,
        ageRating,
        chapterTitle: firstChapter.title,
        chapterText: firstChapter.text,
        visibility,
        announce: announce || null,
      });
      if (!story) return;

      if (chapterMode === "import") {
        // Sequential on purpose — addChapter derives order_index from a
        // fresh max(order_index)+1 query each call, so parallel inserts
        // would race and violate the unique(story_id, order_index) constraint.
        for (const chapter of importedChapters.slice(1)) {
          const formData = new FormData();
          formData.set("title", chapter.title.trim());
          formData.set("content", chapter.html);
          await addChapter(story.id, story.slug, formData);
        }
      }

      router.push(ROUTES.manage(story.slug));
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mx-auto mb-8.5 flex max-w-195 items-center">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              onClick={() => n < step && setStep(n)}
              className={clsx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-[13px] font-bold",
                n === step
                  ? "border-primary-700 bg-primary-700 text-white"
                  : n < step
                    ? "cursor-pointer border-primary-500 bg-primary-50 text-primary-800"
                    : "border-border bg-white text-muted-3"
              )}
            >
              {n}
            </button>
            {n < 3 && (
              <div className={clsx("mx-2.5 h-0.5 flex-1", n < step ? "bg-primary-500" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      <div className="mx-auto flex max-w-195 flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="min-w-0 w-full lg:max-w-190 lg:flex-1">
          {step === 1 && (
            <>
              <div className="mb-5 rounded-3xl border border-border bg-card p-5 sm:p-7.5">
                <h2 className="mb-1.5 text-[22px] font-extrabold">{t.create.coverTitle}</h2>
                <p className="mb-5.5 text-[14px] text-muted">{t.create.coverBody}</p>
                <div className="flex flex-col items-start gap-5 sm:flex-row">
                  <div className="relative h-56 w-full shrink-0 overflow-hidden rounded-2xl bg-primary-200 shadow-[0_10px_26px_rgba(60,40,120,0.16)] sm:w-42">
                    {coverUrl && <Image src={coverUrl} alt="" fill className="object-cover" />}
                  </div>
                  <label className="flex h-40 w-full flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary-300 bg-surface text-center hover:bg-primary-50 sm:h-56">
                    <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
                    <span className="text-[14.5px] font-bold text-primary-800">
                      {coverUploading ? t.common.loading : t.create.uploadCover}
                    </span>
                    <span className="text-[12.5px] text-muted-2">{t.create.coverRecommended}</span>
                    {coverError && <span className="text-[12px] text-danger">{coverError}</span>}
                  </label>
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-5 sm:p-7.5">
                <label className="mb-2 block text-[14px] font-bold">{t.create.titleLabel} *</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.create.titlePlaceholder} className="mb-5" />

                <label className="mb-2 block text-[14px] font-bold">{t.create.descLabel} *</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.create.descPlaceholder}
                  rows={4}
                  className="mb-5"
                />

                <label className="mb-2 block text-[14px] font-bold">{t.create.genreLabel} *</label>
                <div className="mb-5 flex flex-wrap gap-2">
                  {t.genres.map((g) => (
                    <Chip key={g} active={genre === g} onClick={() => setGenre(g)}>
                      {g}
                    </Chip>
                  ))}
                </div>

                <label className="mb-2 block text-[14px] font-bold">
                  {t.create.relationshipLabel}{" "}
                  <span className="font-medium text-muted-2">{t.create.relationshipHint}</span>
                </label>
                <div className="mb-5 flex flex-wrap gap-2">
                  {RELATIONSHIP_TYPES.map(([r, rUz]) => (
                    <Chip
                      key={r}
                      active={relationshipType === r}
                      onClick={() => setRelationshipType((prev) => (prev === r ? null : r))}
                    >
                      {locale === "uz" ? rUz : r}
                    </Chip>
                  ))}
                </div>

                <label className="mb-2 block text-[14px] font-bold">
                  {t.create.tagsLabel} <span className="font-medium text-muted-2">{t.create.tagsHint}</span>
                </label>
                <div className="mb-5 flex flex-wrap gap-2">
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

                <label className="mb-2 block text-[14px] font-bold">{t.create.languageLabel} *</label>
                <div className="mb-5 flex gap-2.5">
                  {(["ru", "uz"] as const).map((code) => (
                    <Chip key={code} active={language === code} onClick={() => setLanguage(code)}>
                      {t.languages[code]}
                    </Chip>
                  ))}
                </div>

                <label className="mb-1 block text-[14px] font-bold">{t.create.ageRatingLabel}</label>
                <div className="mb-2.5 text-[13px] text-muted-2">{t.create.ageRatingHint}</div>
                <div className="grid grid-cols-4 gap-2.5">
                  {t.ageRatings.map((age) => (
                    <button
                      key={age}
                      type="button"
                      onClick={() => setAgeRating(age as AgeRating)}
                      className={clsx(
                        "flex flex-col items-start gap-0.5 rounded-[13px] border px-3.5 py-2.5 text-left",
                        ageRating === age ? "border-primary-500 bg-primary-50" : "border-border bg-white"
                      )}
                    >
                      <span className="text-[14.5px] font-bold">{age}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="rounded-3xl border border-border bg-card p-5 sm:p-7.5">
              <h2 className="mb-4 text-[22px] font-extrabold">{t.create.step2}</h2>

              <div className="mb-5.5 flex gap-2.5">
                <Chip active={chapterMode === "manual"} onClick={() => setChapterMode("manual")}>
                  {t.create.chapterModeManual}
                </Chip>
                <Chip active={chapterMode === "import"} onClick={() => setChapterMode("import")}>
                  {t.create.chapterModeImport}
                </Chip>
              </div>

              {chapterMode === "manual" ? (
                <>
                  <label className="mb-2 block text-[14px] font-bold">{t.create.chapterTitleLabel} *</label>
                  <Input
                    value={chapterTitle}
                    onChange={(e) => setChapterTitle(e.target.value)}
                    placeholder={t.create.chapterTitlePlaceholder}
                    className="mb-5"
                  />
                  <RichTextEditor
                    value={chapterText}
                    onChange={setChapterText}
                    placeholder={t.create.chapterTextPlaceholder}
                  />
                  <div className="mt-4.5 flex items-center gap-3 rounded-2xl border border-primary-100 bg-primary-50 px-4.5 py-3.5 text-[13.5px] text-ink-soft">
                    {t.create.autosaveHint}
                  </div>
                </>
              ) : importedChapters.length > 0 ? (
                <div>
                  <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
                    <span className="text-[14px] font-bold text-primary-900">
                      ✓ {t.create.chapterModeImportedN.replace("{n}", String(importedChapters.length))}
                    </span>
                    <button
                      type="button"
                      onClick={() => setImportedChapters([])}
                      className="cursor-pointer text-[13px] font-bold text-primary-800"
                    >
                      {t.create.chapterModeImportRedo}
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {importedChapters.map((c, i) => (
                      <div key={c.id} className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-ink-soft">
                        {i + 1}. {c.title || t.manage.untitledChapter}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <DocxImportFlow
                  onConfirm={setImportedChapters}
                  confirmLabel={(count) => t.create.chapterModeImportConfirm.replace("{n}", String(count))}
                />
              )}
            </div>
          )}

          {step === 3 && (
            <>
              <div className="mb-5 rounded-3xl border border-border bg-card p-5 sm:p-7.5">
                <h2 className="mb-5 text-[22px] font-extrabold">{t.create.visibilityTitle}</h2>
                <div className="flex flex-col gap-3">
                  {(
                    [
                      ["public", t.create.visibilityPublicLabel, t.create.visibilityPublicDesc],
                      ["unlisted", t.create.visibilityUnlistedLabel, t.create.visibilityUnlistedDesc],
                      ["draft", t.common.draft, t.create.visibilityDraftDesc],
                    ] as const
                  ).map(([value, titleText, desc]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setVisibility(value)}
                      className={clsx(
                        "flex items-center gap-3.5 rounded-2xl border px-4.5 py-3.5 text-left",
                        visibility === value ? "border-primary-500 bg-primary-50" : "border-border bg-white"
                      )}
                    >
                      <span
                        className={clsx(
                          "h-4.5 w-4.5 shrink-0 rounded-full border-2",
                          visibility === value ? "border-primary-700 bg-primary-700" : "border-border"
                        )}
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[15px] font-bold">{titleText}</span>
                        <span className="text-[13px] font-medium text-muted">{desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-5 sm:p-7.5">
                <label className="mb-2 block text-[14px] font-bold">
                  {t.create.announceLabel} <span className="font-medium text-muted-2">{t.create.announceHint}</span>
                </label>
                <Textarea
                  value={announce}
                  onChange={(e) => setAnnounce(e.target.value)}
                  placeholder={t.create.announcePlaceholder}
                  rows={3}
                />
              </div>
            </>
          )}

          <div className="mt-6 flex gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="h-13.5 cursor-pointer rounded-[15px] border border-border bg-white px-6 text-[15px] font-semibold text-ink-soft"
              >
                {t.common.back}
              </button>
            )}
            <button
              type="button"
              disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid) || pending}
              onClick={() => (step < 3 ? setStep((s) => s + 1) : handlePublish())}
              className="h-13.5 flex-1 cursor-pointer rounded-[15px] border-none bg-linear-to-br from-primary-800 to-primary-600 text-[16px] font-bold text-white shadow-[0_10px_24px_rgba(109,40,217,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {step < 3 ? t.common.next : pending ? t.common.loading : t.create.publish}
            </button>
          </div>
        </div>

        <div className="w-full rounded-[22px] border border-border bg-card p-5.5 lg:sticky lg:top-26 lg:w-75 lg:shrink-0">
          <div className="mb-3.5 text-[13px] font-bold uppercase tracking-wide text-muted-2">
            {t.create.previewTitle}
          </div>
          <div className="mb-4 flex gap-3.5 overflow-hidden rounded-[18px] border border-border sm:block">
            <div className="relative aspect-[3/4] w-28 shrink-0 bg-primary-200 sm:w-full">
              {coverUrl && <Image src={coverUrl} alt="" fill className="object-cover" />}
            </div>
            <div className="p-3.5">
              <h3 className="mb-1 line-clamp-2 text-[15.5px] font-bold">{title || t.create.titlePlaceholder}</h3>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-lg bg-primary-100 px-2.5 py-1 text-[11.5px] font-bold text-primary-800">
                  {genre}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

