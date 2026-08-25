import { generateHTML, type JSONContent } from "@tiptap/core";
import { getEditorExtensions } from "@/components/ui/RichTextEditor";

export interface SplitChapter {
  id: string;
  title: string;
  html: string;
  preview: string;
}

// Walks the editor's top-level block nodes and splits them into one segment
// per chapterMarker node (import-time-only node, see chapterMarkerNode.tsx —
// never present in a normal chapter's saved content, so this only ever runs
// during the .docx import "split and preview" step). Content before the
// first marker becomes its own untitled leading segment rather than being
// silently dropped — the author can still title or discard it in the
// preview step.
export function splitChaptersAtMarkers(doc: JSONContent): SplitChapter[] {
  const topLevel = doc.content ?? [];
  const groups: { title: string; nodes: JSONContent[] }[] = [{ title: "", nodes: [] }];

  for (const node of topLevel) {
    if (node.type === "chapterMarker") {
      groups.push({ title: (node.attrs?.title as string | undefined) ?? "", nodes: [] });
    } else {
      groups[groups.length - 1].nodes.push(node);
    }
  }

  const extensions = getEditorExtensions();

  return groups
    .filter((g) => g.nodes.length > 0)
    .map((g, i) => {
      const html = generateHTML({ type: "doc", content: g.nodes }, extensions);
      const preview = html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 150);
      return { id: `${i}`, title: g.title, html, preview };
    });
}
