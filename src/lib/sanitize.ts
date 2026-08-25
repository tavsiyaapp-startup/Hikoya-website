import DOMPurify from "isomorphic-dompurify";

// Allowlist matches what RichTextEditor's schema can produce
// (src/components/ui/RichTextEditor.tsx) — bold/italic/strike/underline,
// h1/h2, blockquote, hr, and inline font-size/font-family via style on a
// span — plus <img> for pictures carried over from a .docx import
// (src/lib/actions/import-docx.ts uploads each one to Storage first, so src
// always points at a Supabase public URL by the time this runs). Used both
// when writing a chapter (src/lib/actions/stories.ts) and again right before
// rendering it (reader page) — never trust stored HTML blindly even though
// it's already cleaned at write time.
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "strong", "em", "s", "u", "h1", "h2", "blockquote", "hr", "span", "br", "img"],
    ALLOWED_ATTR: ["style", "src", "alt"],
  });
}
