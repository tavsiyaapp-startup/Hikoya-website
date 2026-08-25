"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, FontFamily, FontSize } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { clsx } from "clsx";
import { AlignLeftIcon, AlignCenterIcon } from "@/components/ui/icons";
import { ChapterMarker } from "@/lib/editor/chapterMarkerNode";

export interface RichTextEditorHandle {
  insertChapterMarker: () => void;
  getEditor: () => Editor | null;
}

// Chapters written before this editor existed are stored as plain text with
// bare "\n" line breaks. Fed straight into TipTap's HTML parser, that becomes
// one unbroken paragraph (HTML ignores literal newlines) — so an author
// opening an old chapter to edit it would see every paragraph mashed
// together. If the incoming content has no tags at all, treat it as legacy
// plain text and wrap each line in its own <p>; already-HTML content
// (anything written with this editor) passes through untouched.
function normalizeToHtml(content: string): string {
  if (!content || /<[a-z][\s\S]*>/i.test(content)) return content;
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return content
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => `<p>${escape(line)}</p>`)
    .join("");
}

// Shared with src/lib/editor/splitChapters.ts, which re-renders split-out
// document fragments back to HTML via generateHTML() outside of any live
// editor instance — must use the exact same node/mark schema this editor
// uses, or content written here could fail to round-trip correctly there.
export function getEditorExtensions() {
  return [
    StarterKit.configure({
      bulletList: false,
      orderedList: false,
      listItem: false,
      listKeymap: false,
      link: false,
      code: false,
      codeBlock: false,
      heading: { levels: [1, 2] },
    }),
    TextStyle,
    FontFamily,
    FontSize,
    TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center"] }),
    Image,
  ];
}

const FONT_SIZES = [
  { label: "Мелкий", value: "13px" },
  { label: "Обычный", value: "" },
  { label: "Крупный", value: "20px" },
  { label: "Заголовок", value: "28px" },
];

const FONT_FAMILIES = [
  { label: "Manrope", value: "var(--font-sans)" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
];

function ToolbarButton({
  active,
  onClick,
  label,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  label: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={clsx(
        "flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-[8px] px-2 text-[13px] font-bold transition",
        active ? "bg-primary-100 text-primary-900" : "text-ink-soft hover:bg-surface"
      )}
    >
      {label}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const currentFontSize = FONT_SIZES.find(
    (f) => f.value === (editor.getAttributes("textStyle").fontSize ?? "")
  );
  const currentFontFamily =
    FONT_FAMILIES.find((f) => f.value === editor.getAttributes("textStyle").fontFamily)?.value ??
    FONT_FAMILIES[0].value;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
      <ToolbarButton
        title="Жирный (Ctrl+B)"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="B"
      />
      <ToolbarButton
        title="Курсив (Ctrl+I)"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label={<span className="italic">I</span>}
      />
      <ToolbarButton
        title="Зачёркнутый"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        label={<span className="line-through">S</span>}
      />
      <ToolbarButton
        title="Подчёркнутый"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        label={<span className="underline">U</span>}
      />

      <span className="mx-1 h-5 w-px bg-border" />

      <select
        title="Размер текста"
        value={currentFontSize?.value ?? ""}
        onChange={(e) => {
          const size = e.target.value;
          const chain = editor.chain().focus();
          if (size) chain.setFontSize(size).run();
          else chain.unsetFontSize().run();
        }}
        className="h-8 cursor-pointer rounded-[8px] border border-border bg-white px-1.5 text-[12.5px] text-ink-soft outline-none"
      >
        {FONT_SIZES.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        title="Шрифт"
        value={currentFontFamily}
        onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
        className="h-8 cursor-pointer rounded-[8px] border border-border bg-white px-1.5 text-[12.5px] text-ink-soft outline-none"
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton
        title="Заголовок 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        label="H1"
      />
      <ToolbarButton
        title="Заголовок 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        label="H2"
      />

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton
        title="По левому краю"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        label={<AlignLeftIcon />}
      />
      <ToolbarButton
        title="По центру"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        label={<AlignCenterIcon />}
      />

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton
        title="Цитата"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        label="&ldquo;"
      />
      <ToolbarButton
        title="Разделитель сцены"
        active={false}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        label="—"
      />
    </div>
  );
}

export const RichTextEditor = forwardRef<
  RichTextEditorHandle,
  {
    name?: string;
    defaultValue?: string;
    value?: string;
    onChange?: (html: string) => void;
    placeholder?: string;
    required?: boolean;
    className?: string;
    enableChapterMarkers?: boolean;
  }
>(function RichTextEditor(
  { name, defaultValue, value, onChange, placeholder, className, enableChapterMarkers },
  ref
) {
  const initialHtml = normalizeToHtml(value ?? defaultValue ?? "");
  const [html, setHtml] = useState(initialHtml);

  const editor = useEditor({
    immediatelyRender: false,
    content: initialHtml,
    extensions: [
      ...getEditorExtensions(),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      ...(enableChapterMarkers ? [ChapterMarker] : []),
    ],
    onUpdate: ({ editor }) => {
      const nextHtml = editor.getHTML();
      setHtml(nextHtml);
      onChange?.(nextHtml);
    },
    editorProps: {
      attributes: {
        class: "rich-editor-content min-h-40 px-4 py-3.5 text-[15px] leading-relaxed text-ink outline-none",
      },
    },
  });

  // Keep TipTap in sync when the caller controls `value` externally
  // (CreateWizard) — only push when it actually diverges, to avoid clobbering
  // the cursor position on every keystroke.
  useEffect(() => {
    if (editor && value !== undefined && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  useImperativeHandle(
    ref,
    () => ({
      insertChapterMarker: () => {
        editor?.chain().focus().insertContent({ type: "chapterMarker", attrs: { title: "" } }).run();
      },
      getEditor: () => editor ?? null,
    }),
    [editor]
  );

  if (!editor) {
    return (
      <div
        className={clsx("min-h-48 w-full rounded-[13px] border border-border bg-surface", className)}
      />
    );
  }

  return (
    <div
      className={clsx(
        "w-full overflow-hidden rounded-[13px] border border-border bg-surface transition focus-within:border-primary-500 focus-within:bg-white",
        className
      )}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      {name && <input type="hidden" name={name} value={html} />}
    </div>
  );
});
