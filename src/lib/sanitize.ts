import sanitizeHtmlLib from "sanitize-html";

// Where chapter images may come from: this site's own uploads (current
// storage, src/server/storage/local.ts) or the old Supabase Storage public
// bucket (images uploaded before the move — still referenced by existing
// chapters). Anything else is dropped: an author-supplied external <img>
// would let them track every reader's IP, and the .docx export
// (src/lib/docx/htmlToDocx.ts) would otherwise fetch arbitrary URLs from the
// server.
// Only Hikoya's own (old) Supabase project — not any *.supabase.co, which
// anyone can create for free and use to log every reader's IP address.
const SUPABASE_PUBLIC_IMAGE = /^https:\/\/krmyymorexsfwpvkfqzq\.supabase\.co\/storage\/v1\/object\/public\/[^\s"'<>]+$/i;
const LOCAL_UPLOAD_IMAGE = /^\/uploads\/[a-z-]+\/[A-Za-z0-9-]+\/[A-Za-z0-9.-]+$/;

export function isAllowedImageSrc(src: string | undefined | null): boolean {
  if (!src) return false;
  return LOCAL_UPLOAD_IMAGE.test(src) || SUPABASE_PUBLIC_IMAGE.test(src);
}

// Allowlist matches what RichTextEditor's schema can produce
// (src/components/ui/RichTextEditor.tsx) — bold/italic/strike/underline,
// h1/h2, blockquote, hr, inline font-size/font-family on a span, left/center
// text alignment — plus <img> for uploaded/imported pictures. Used both when
// writing a chapter and again right before rendering it, so tightening this
// also cleans already-stored chapters on display.
//
// `style` is restricted to exactly those three properties with value
// patterns: a free-form style attribute let an author lay a fixed,
// full-screen element over the reader page (fake "log in again" form on
// hikoya.org) or load tracking images via url(...).
//
// sanitize-html instead of isomorphic-dompurify: the latter pulls in jsdom,
// which breaks at runtime (ERR_REQUIRE_ESM); sanitize-html uses a pure-CJS
// parser (htmlparser2), no DOM shim involved.
export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: ["p", "strong", "em", "s", "u", "h1", "h2", "blockquote", "hr", "span", "br", "img"],
    allowedAttributes: { "*": ["style"], img: ["src", "alt"] },
    allowedStyles: {
      "*": {
        "font-size": [/^\d{1,2}(\.\d+)?px$/],
        "font-family": [/^[\w\s'",-]+$/, /^var\(--font-[a-z-]+\)$/],
        "text-align": [/^(left|center|right|justify)$/],
      },
    },
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    exclusiveFilter: (frame) => frame.tag === "img" && !isAllowedImageSrc(frame.attribs.src),
  });
}
