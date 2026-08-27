"use client";

import { Node, mergeAttributes, type NodeViewProps } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";

// Only used by the .docx import wizard's "mark chapter boundaries" step
// (ImportWizard.tsx) — an atomic, non-editable-inside block that carries a
// title. splitChaptersAtMarkers() (import/splitChapters.ts) walks the
// editor's JSON doc and splits the manuscript into one chapter per marker.
function ChapterMarkerView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  return (
    <NodeViewWrapper
      contentEditable={false}
      className="my-4 flex items-center gap-2.5 rounded-[12px] border-2 border-dashed border-primary-300 bg-primary-50 px-4 py-3"
    >
      <span className="shrink-0 text-[11.5px] font-bold uppercase tracking-wide text-primary-700">
        Начало главы
      </span>
      <input
        value={node.attrs.title as string}
        onChange={(e) => updateAttributes({ title: e.target.value })}
        placeholder="Название главы"
        className="min-w-0 flex-1 rounded-[8px] border border-primary-200 bg-card px-2.5 py-1.5 text-[13.5px] outline-none focus:border-primary-500"
      />
      <button
        type="button"
        onClick={() => deleteNode()}
        className="shrink-0 cursor-pointer text-[13px] font-bold text-danger"
        title="Убрать метку"
      >
        ✕
      </button>
    </NodeViewWrapper>
  );
}

export const ChapterMarker = Node.create({
  name: "chapterMarker",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      title: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-chapter-marker]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-chapter-marker": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChapterMarkerView);
  },
});
