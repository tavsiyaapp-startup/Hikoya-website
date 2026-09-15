import "server-only";
import { Parser } from "htmlparser2";
import { Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";

// Converts one chapter's stored content into docx paragraphs. Content is
// either rich HTML from RichTextEditor (src/components/ui/RichTextEditor.tsx)
// — a small fixed tag set enforced by sanitizeHtml (src/lib/sanitize.ts):
// p/h1/h2/blockquote/hr/span(style)/strong/em/u/s/br/img — or, for anything
// published before the rich-text editor existed, plain text with no tags at
// all (same tag-sniff the reader page uses to pick a rendering path).
const HAS_HTML_TAGS = /<[a-z][\s\S]*>/i;

type RunFormat = {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  underline?: { type: "single" };
  size?: number;
  font?: string;
};

type FetchedImage = { type: "jpg" | "png" | "gif" | "bmp"; data: Buffer; width: number; height: number };

const MAX_IMAGE_WIDTH_PX = 500;

function docxImageType(contentType: string, url: string): FetchedImage["type"] | null {
  const s = (contentType || url).toLowerCase();
  if (s.includes("png")) return "png";
  if (s.includes("jpeg") || s.includes("jpg")) return "jpg";
  if (s.includes("gif")) return "gif";
  if (s.includes("bmp")) return "bmp";
  return null;
}

// Word requires an explicit pixel size per embedded image (docx's
// ImageRun.transformation) — there's no "use the file's natural size"
// option — so this reads it straight out of the file's own header instead
// of pulling in an image-processing dependency for one number pair.
function readImageDimensions(buf: Buffer, type: FetchedImage["type"]): { width: number; height: number } | null {
  try {
    if (type === "png" && buf.length >= 24) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (type === "gif" && buf.length >= 10) {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }
    if (type === "bmp" && buf.length >= 26) {
      return { width: buf.readInt32LE(18), height: Math.abs(buf.readInt32LE(22)) };
    }
    if (type === "jpg") {
      let offset = 2;
      while (offset < buf.length - 9) {
        if (buf[offset] !== 0xff) break;
        const marker = buf[offset + 1];
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          offset += 2;
          continue;
        }
        const length = buf.readUInt16BE(offset + 2);
        const isSofMarker = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isSofMarker) {
          return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
        }
        offset += 2 + length;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function scaledTransformation(width: number, height: number) {
  if (width <= MAX_IMAGE_WIDTH_PX || width <= 0) return { width: width || 1, height: height || 1 };
  const ratio = MAX_IMAGE_WIDTH_PX / width;
  return { width: MAX_IMAGE_WIDTH_PX, height: Math.max(1, Math.round(height * ratio)) };
}

// The parser below is synchronous (htmlparser2 has no async hooks), but
// embedding an <img> in the .docx needs its bytes fetched from Storage
// first — so images are resolved in one async pass up front, keyed by src,
// before the real (sync) parse runs.
async function fetchImages(html: string): Promise<Map<string, FetchedImage>> {
  const urls = new Set<string>();
  for (const m of html.matchAll(/<img[^>]*\ssrc="([^"]+)"/gi)) urls.add(m[1]);

  const map = new Map<string, FetchedImage>();
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        // Bounded so one slow/hanging Storage response can't eat the whole
        // request's time budget — better to embed 9 of 10 images than to
        // stall the entire export waiting on one.
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const type = docxImageType(res.headers.get("content-type") ?? "", url);
        if (!type) return;
        const data = Buffer.from(await res.arrayBuffer());
        const dims = readImageDimensions(data, type) ?? { width: 400, height: 300 };
        map.set(url, { type, data, ...dims });
      } catch {
        // Skip images we can't fetch/decode — the rest of the chapter still exports.
      }
    })
  );
  return map;
}

export async function chapterContentToDocxParagraphs(content: string): Promise<Paragraph[]> {
  if (!HAS_HTML_TAGS.test(content)) {
    const parts = content.split(/\n+/).filter((p) => p.trim().length > 0);
    if (parts.length === 0) return [new Paragraph({ children: [new TextRun("")] })];
    return parts.map((text) => new Paragraph({ spacing: { after: 200 }, children: [new TextRun(text)] }));
  }

  const images = await fetchImages(content);
  const paragraphs: Paragraph[] = [];

  let blockTag: "p" | "h1" | "h2" | "blockquote" | null = null;
  let runs: (TextRun | ImageRun)[] = [];
  const formatStack: RunFormat[] = [{}];
  const currentFormat = () => formatStack[formatStack.length - 1];

  function flushBlock() {
    if (blockTag === null) return;
    paragraphs.push(
      new Paragraph({
        heading: blockTag === "h1" ? HeadingLevel.HEADING_1 : blockTag === "h2" ? HeadingLevel.HEADING_2 : undefined,
        indent: blockTag === "blockquote" ? { left: 480 } : undefined,
        spacing: { after: 200 },
        children: runs.length > 0 ? runs : [new TextRun("")],
      })
    );
    runs = [];
    blockTag = null;
  }

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (name === "p" || name === "h1" || name === "h2" || name === "blockquote") {
          flushBlock();
          blockTag = name;
        } else if (name === "hr") {
          flushBlock();
          paragraphs.push(
            new Paragraph({
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" } },
              spacing: { before: 100, after: 300 },
              alignment: AlignmentType.CENTER,
            })
          );
        } else if (name === "br") {
          runs.push(new TextRun({ text: "", break: 1 }));
        } else if (name === "strong") {
          formatStack.push({ ...currentFormat(), bold: true });
        } else if (name === "em") {
          formatStack.push({ ...currentFormat(), italics: true });
        } else if (name === "u") {
          formatStack.push({ ...currentFormat(), underline: { type: "single" } });
        } else if (name === "s") {
          formatStack.push({ ...currentFormat(), strike: true });
        } else if (name === "span") {
          const style = attribs.style ?? "";
          const sizeMatch = style.match(/font-size:\s*(\d+(?:\.\d+)?)px/);
          const fontMatch = style.match(/font-family:\s*([^;]+)/);
          formatStack.push({
            ...currentFormat(),
            // CSS px -> docx half-points (docx sizes are in half-points; 1px ~= 1.5 half-points at 96dpi/12pt baseline).
            ...(sizeMatch ? { size: Math.round(Number(sizeMatch[1]) * 1.5) } : {}),
            ...(fontMatch ? { font: fontMatch[1].replace(/["']/g, "").trim() } : {}),
          });
        } else if (name === "img") {
          const src = attribs.src;
          const img = src ? images.get(src) : undefined;
          if (img) {
            const { width, height } = scaledTransformation(img.width, img.height);
            runs.push(new ImageRun({ type: img.type, data: img.data, transformation: { width, height } }));
          }
        }
      },
      ontext(text) {
        if (blockTag === null || text.trim().length === 0) return;
        runs.push(new TextRun({ text, ...currentFormat() }));
      },
      onclosetag(name) {
        if (name === "p" || name === "h1" || name === "h2" || name === "blockquote") {
          flushBlock();
        } else if (name === "strong" || name === "em" || name === "u" || name === "s" || name === "span") {
          formatStack.pop();
        }
      },
    },
    { decodeEntities: true }
  );

  parser.write(content);
  parser.end();
  flushBlock();

  return paragraphs.length > 0 ? paragraphs : [new Paragraph({ children: [new TextRun("")] })];
}
