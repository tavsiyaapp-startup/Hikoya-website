"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addChapter } from "@/lib/actions/stories";
import { DocxImportFlow } from "@/components/manage/DocxImportFlow";
import type { SplitChapter } from "@/lib/editor/splitChapters";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";

export function ImportWizard({ storyId, storySlug }: { storyId: string; storySlug: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [savedCount, setSavedCount] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  // How many chapters of the current batch are already saved — a retry
  // continues from here, so chapters that went through aren't added twice.
  const savedRef = useRef(0);

  function handleConfirm(chapters: SplitChapter[]) {
    setSaveError(null);
    startSaving(async () => {
      setSavedCount(savedRef.current);
      // Sequential on purpose — addChapter computes order_index as
      // max(order_index)+1 via a fresh query each call, so parallel calls
      // would race and violate the unique(story_id, order_index) constraint.
      for (const chapter of chapters.slice(savedRef.current)) {
        const formData = new FormData();
        formData.set("title", chapter.title.trim());
        formData.set("content", chapter.html);
        const saved = await addChapter(storyId, storySlug, formData).catch(() => false);
        if (!saved) {
          setSaveError(
            t.manage.importSaveError.replace("{saved}", String(savedRef.current)).replace("{total}", String(chapters.length))
          );
          return;
        }
        savedRef.current += 1;
        setSavedCount(savedRef.current);
      }
      savedRef.current = 0;
      router.push(`${ROUTES.manage(storySlug)}?tab=chapters`);
      router.refresh();
    });
  }

  return (
    <div className="max-w-190">
      <DocxImportFlow
        onConfirm={handleConfirm}
        confirmPending={saving}
        confirmLabel={(count) =>
          saving ? `${t.common.loading} ${savedCount}/${count}` : t.manage.saveChaptersN.replace("{n}", String(count))
        }
      />
      {saveError && <p className="mt-3 text-[13px] text-danger">{saveError}</p>}
    </div>
  );
}
