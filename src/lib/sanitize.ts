import sanitizeHtmlLib from "sanitize-html";

// Allowlist matches what RichTextEditor's schema can produce
// (src/components/ui/RichTextEditor.tsx) — bold/italic/strike/underline,
// h1/h2, blockquote, hr, and inline font-size/font-family via style on a
// span — plus <img> for pictures carried over from a .docx import
// (src/lib/actions/import-docx.ts uploads each one to Storage first, so src
// always points at a Supabase public URL by the time this runs). Used both
// when writing a chapter (src/lib/actions/stories.ts) and again right before
// rendering it (reader page) — never trust stored HTML blindly even though
// it's already cleaned at write time.
//
// sanitize-html instead of isomorphic-dompurify: the latter pulls in jsdom,
// whose html-encoding-sniffer dependency now requires an ESM-only package
// (@exodus/bytes) via a plain CommonJS require() — that throws ERR_REQUIRE_ESM
// at runtime on Vercel regardless of bundling strategy, taking down every
// chapter page. sanitize-html does the same job with a pure-CJS parser
// (htmlparser2), no DOM shim involved.
export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: ["p", "strong", "em", "s", "u", "h1", "h2", "blockquote", "hr", "span", "br", "img"],
    allowedAttributes: { "*": ["style", "src", "alt"] },
  });
}
