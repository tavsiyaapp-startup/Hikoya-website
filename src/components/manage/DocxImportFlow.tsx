"use client";

import { useRef, useState } from "react";
import { convertDocxToHtml } from "@/lib/actions/import-docx";
import { splitChaptersAtMarkers, type SplitChapter } from "@/lib/editor/splitChapters";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/ui/RichTextEditor";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Step = "upload" | "mark" | "preview";

// Upload → mark chapter breaks → preview/edit titles → confirm. What happens
// on confirm is entirely up to the caller: the standalone /manage/[slug]/import
// page saves the chapters immediately (looping the existing addChapter action)
// and redirects away, while CreateWizard just holds the result in its own
// state until the story itself is created at the end of the wizard.
export function DocxImportFlow({
  onConfirm,
  confirmLabel,
  confirmPending,
}: {
  onConfirm: (chapters: SplitChapter[]) => void;
  confirmLabel: (count: number) => string;
  confirmPending?: boolean;
}) {
  const { t } = useLocale();
  const editorRef = useRef<RichTextEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [docHtml, setDocHtml] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [chapters, setChapters] = useState<SplitChapter[]>([]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setConverting(true);
    setUploadError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await convertDocxToHtml(formData);
    setConverting(false);
    if ("error" in result) {
      setUploadError(t.manage.importError);
      return;
    }
    setDocHtml(result.html);
    setStep("mark");
  }

  function handleSplitAndPreview() {
    const editor = editorRef.current?.getEditor();
    if (!editor) return;
    setChapters(splitChaptersAtMarkers(editor.getJSON()));
    setStep("preview");
  }

  function updateChapterTitle(id: string, title: string) {
    setChapters((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }

  const allTitled = chapters.length > 0 && chapters.every((c) => c.title.trim().length > 0);

  return (
    <div>
      {step === "upload" && (
        <div className="rounded-3xl border border-border bg-card p-6.5 sm:p-7.5">
          <p className="mb-5 text-[14.5px] leading-relaxed text-ink-soft">{t.manage.importBody}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            onChange={handleFileSelected}
            className="hidden"
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={converting}>
            {converting ? t.common.loading : t.manage.chooseFile}
          </Button>
          {uploadError && <p className="mt-3 text-[13px] text-danger">{uploadError}</p>}
        </div>
      )}

      {/* Kept mounted across "mark" and "preview" so going back never loses
          the author's marker placements — only visibility toggles. */}
      {docHtml !== null && (
        <div className={step === "mark" ? "" : "hidden"}>
          {/* Sticky, not just top-of-page — a manuscript can run long, and
              scrolling all the way back up to mark every chapter break was
              slow enough that authors were misplacing markers. */}
          <div className="sticky top-16 z-10 mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-[0_8px_20px_rgba(60,40,120,0.1)] sm:top-20">
            <Button variant="secondary" onClick={() => editorRef.current?.insertChapterMarker()}>
              {t.manage.markChapterStart}
            </Button>
            <Button className="ml-auto" onClick={handleSplitAndPreview}>
              {t.manage.splitAndPreview}
            </Button>
          </div>
          <RichTextEditor ref={editorRef} defaultValue={docHtml} enableChapterMarkers />
        </div>
      )}

      {step === "preview" && (
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[18px] font-extrabold">
              {t.manage.previewTitleN.replace("{n}", String(chapters.length))}
            </h2>
            <div className="flex gap-2.5">
              <Button variant="ghost" onClick={() => setStep("mark")} disabled={confirmPending}>
                {t.manage.undoMarking}
              </Button>
              <Button onClick={() => onConfirm(chapters)} disabled={!allTitled || confirmPending}>
                {confirmLabel(chapters.length)}
              </Button>
            </div>
          </div>

          {chapters.length > 0 && !allTitled && (
            <p className="mb-3.5 text-[13px] text-danger">{t.manage.importTitlesRequired}</p>
          )}

          {chapters.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-soft bg-surface px-6 py-10 text-center text-[14px] text-muted">
              {t.manage.noMarkersFound}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {chapters.map((c, i) => (
                <div key={c.id} className="rounded-[18px] border border-border bg-card p-4.5">
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="shrink-0 text-[13px] font-bold text-muted-3">{i + 1}.</span>
                    <Input
                      value={c.title}
                      onChange={(e) => updateChapterTitle(c.id, e.target.value)}
                      placeholder={t.manage.untitledChapter}
                      className={c.title.trim().length === 0 ? "border-danger" : undefined}
                    />
                  </div>
                  <p className="line-clamp-2 pl-6 text-[13.5px] leading-relaxed text-muted-2">
                    {c.preview || t.manage.emptyChapterPreview}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
