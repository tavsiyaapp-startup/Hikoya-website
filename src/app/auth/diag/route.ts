import { NextResponse } from "next/server";

// Temporary diagnostic route — isolates whether sanitizeHtml (isomorphic-dompurify/jsdom)
// is what's crashing chapter pages in production. Delete once confirmed either way.
export async function GET() {
  try {
    const { sanitizeHtml } = await import("@/lib/sanitize");
    const result = sanitizeHtml("<p>test <strong>bold</strong></p>");
    return NextResponse.json({ ok: true, result, buildMarker: "diag-v1" });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : null,
      },
      { status: 500 }
    );
  }
}
