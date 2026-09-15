import "server-only";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } from "docx";
import { sanitizeHtml } from "@/lib/sanitize";
import { chapterContentToDocxParagraphs } from "./htmlToDocx";

export type ExportChapter = { order_index: number; title: string; content: string };

// Builds a single .docx snapshot of a story's chapters exactly as they
// stand right now — admin-only download, no caching: every request re-reads
// the chapters table and re-renders, so a chapter added five minutes ago is
// already in the next download.
export async function buildStoryDocx(
  storyTitle: string,
  authorName: string,
  chapters: ExportChapter[]
): Promise<Buffer> {
  const body: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun(storyTitle)],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: authorName, italics: true })],
    }),
  ];

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    if (i > 0) body.push(new Paragraph({ children: [new PageBreak()] }));
    body.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 300 },
        children: [new TextRun(`${ch.order_index}. ${ch.title}`)],
      })
    );
    // Sanitized again here even though it's already clean at write time —
    // same "never trust stored HTML blindly" rule the reader page follows
    // (see sanitizeHtml's own comment in src/lib/sanitize.ts).
    body.push(...(await chapterContentToDocxParagraphs(sanitizeHtml(ch.content))));
  }

  const doc = new Document({ sections: [{ children: body }] });
  return Packer.toBuffer(doc);
}
