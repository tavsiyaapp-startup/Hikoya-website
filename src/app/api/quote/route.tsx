import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { chapters, profiles, stories } from "@/server/db/schema";
import { canViewChapter } from "@/server/authz/policy";
import { isUuid } from "@/server/data/forum";
import { takeRateLimit } from "@/server/rate-limit";
import { coverPalette } from "@/components/story/GeneratedCover";

// Quote card: a picture of a sentence from a chapter, with the book's
// title, author and the Hikoya mark — made to be shared in Instagram /
// Telegram stories. Drawn here from a template (next/og: JSX → PNG), so no
// AI and no paid API: the cost is a little CPU per new card, and identical
// cards are cached by the browser for a day.
//
// GET /api/quote?c=<chapter id>&q=<quote>&s=book|paper|night&f=post|story
//
// The quote must really be in that chapter, and the chapter must be public
// — otherwise anyone could put any text under a Hikoya author's name.

export const runtime = "nodejs";

const MIN_LEN = 8;
const MAX_LEN = 300;
const SIZES = { post: { width: 1080, height: 1350 }, story: { width: 1080, height: 1920 } } as const;
type Format = keyof typeof SIZES;
type Style = "book" | "paper" | "night";
type FontEntry = { name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" | "italic" };

const FONT_DIR = path.join(process.cwd(), "public", "fonts", "quote");
let fontsPromise: Promise<FontEntry[]> | null = null;
let logoPromise: Promise<string> | null = null;

// Literata (quote, title) and Manrope (author) — latin, latin-ext (Uzbek ʻ)
// and cyrillic subsets, read once per server process.
function loadFonts() {
  fontsPromise ??= (async () => {
    const file = (f: string) => readFile(path.join(FONT_DIR, `${f}.woff`));
    const subsets = ["latin", "latin-ext", "cyrillic"];
    const out: FontEntry[] = [];
    for (const s of subsets) out.push({ name: "Literata", data: await file(`literata-${s}-600-normal`), weight: 600, style: "normal" });
    for (const s of subsets) out.push({ name: "Literata", data: await file(`literata-${s}-400-italic`), weight: 400, style: "italic" });
    for (const s of subsets) out.push({ name: "Manrope", data: await file(`manrope-${s}-700-normal`), weight: 700, style: "normal" });
    return out;
  })();
  return fontsPromise;
}

function loadLogo() {
  logoPromise ??= readFile(path.join(process.cwd(), "public", "icons", "icon-192.png")).then(
    (b) => `data:image/png;base64,${b.toString("base64")}`
  );
  return logoPromise;
}

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", laquo: "«", raquo: "»",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", mdash: "—", ndash: "–", hellip: "…",
};

// Text as a reader sees it, flattened so that a selection made in the
// browser (line breaks, curly quotes, Uzbek ʻ variants) matches the stored
// HTML of the chapter.
function normalizeQuoteText(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .toLowerCase()
    .replace(/[ʻʼ‘’`´']/g, "'")
    .replace(/[“”«»"„]/g, '"')
    .replace(/[—–]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

function quoteFontSize(len: number, format: Format) {
  const base = len <= 70 ? 66 : len <= 130 ? 56 : len <= 200 ? 48 : 42;
  return format === "story" ? Math.round(base * 1.12) : base;
}

function theme(style: Style, seed: string) {
  if (style === "paper") {
    return { background: "linear-gradient(160deg, #FBF6EA, #F1E6CF)", text: "#2B2118", soft: "#6B5A45", accent: "#A0702F", line: "rgba(43,33,24,0.18)" };
  }
  if (style === "night") {
    return {
      background: "radial-gradient(90% 60% at 20% 0%, #3E2A6B, transparent 70%), linear-gradient(170deg, #1C1730, #0F0C18)",
      text: "#EDEAF6",
      soft: "#A39CC0",
      accent: "#B19EE2",
      line: "rgba(237,234,246,0.2)",
    };
  }
  const p = coverPalette(seed);
  return {
    background: `radial-gradient(90% 60% at 15% 0%, ${p.glow}66, transparent 65%), linear-gradient(165deg, ${p.to}, ${p.from})`,
    text: "#FFFFFF",
    soft: "rgba(255,255,255,0.78)",
    accent: p.glow,
    line: "rgba(255,255,255,0.28)",
  };
}

function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chapterId = url.searchParams.get("c") ?? "";
  const quote = (url.searchParams.get("q") ?? "").replace(/\s+/g, " ").trim();
  const style: Style = (["book", "paper", "night"] as const).find((s) => s === url.searchParams.get("s")) ?? "book";
  const format: Format = url.searchParams.get("f") === "story" ? "story" : "post";

  if (!isUuid(chapterId) || quote.length < MIN_LEN || quote.length > MAX_LEN) {
    return new Response("Bad request", { status: 400 });
  }
  if (!takeRateLimit(`quote:${clientKey(request)}`, 120, 60 * 60 * 1000)) {
    return new Response("Too many requests", { status: 429 });
  }

  try {
    const db = getDb();
    const [row] = await db
      .select({
        chapter: { id: chapters.id, story_id: chapters.story_id, status: chapters.status, content: chapters.content },
        story: {
          id: stories.id,
          author_id: stories.author_id,
          status: stories.status,
          visibility: stories.visibility,
          deleted_at: stories.deleted_at,
          title: stories.title,
        },
        author: profiles.display_name,
      })
      .from(chapters)
      .innerJoin(stories, eq(stories.id, chapters.story_id))
      .innerJoin(profiles, eq(profiles.id, stories.author_id))
      .where(eq(chapters.id, chapterId))
      .limit(1);
    if (!row || !canViewChapter(null, row.chapter, row.story)) return new Response("Not found", { status: 404 });
    if (!normalizeQuoteText(row.chapter.content).includes(normalizeQuoteText(quote))) {
      return new Response("Quote not in chapter", { status: 422 });
    }

    const [fonts, logo] = await Promise.all([loadFonts(), loadLogo()]);
    const th = theme(style, row.story.id);
    const pad = format === "story" ? 110 : 96;

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundImage: th.background,
            backgroundColor: style === "paper" ? "#F6EEDC" : "#1C1730",
            padding: `${pad + (format === "story" ? 120 : 0)}px ${pad}px ${pad}px`,
            color: th.text,
          }}
        >
          <div style={{ display: "flex", fontFamily: "Literata", fontStyle: "italic", fontSize: 220, lineHeight: 0.8, color: th.accent, opacity: 0.85 }}>
            “
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontFamily: "Literata",
              fontWeight: 600,
              fontSize: quoteFontSize(quote.length, format),
              lineHeight: 1.32,
              letterSpacing: "-0.01em",
            }}
          >
            {quote}
          </div>
          <div style={{ display: "flex", flexGrow: 1 }} />
          <div style={{ display: "flex", height: 2, backgroundColor: th.line, marginBottom: 40 }} />
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 680 }}>
              <div style={{ display: "flex", fontFamily: "Literata", fontWeight: 600, fontSize: 40, lineHeight: 1.2 }}>{row.story.title}</div>
              <div
                style={{
                  display: "flex",
                  marginTop: 12,
                  fontFamily: "Manrope",
                  fontWeight: 700,
                  fontSize: 24,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: th.soft,
                }}
              >
                {row.author}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG by next/og, not a page */}
              <img src={logo} width={84} height={84} alt="" style={{ borderRadius: 20, backgroundColor: "rgba(255,255,255,0.92)" }} />
              <div style={{ display: "flex", marginTop: 10, fontFamily: "Manrope", fontWeight: 700, fontSize: 22, color: th.soft }}>hikoya.org</div>
            </div>
          </div>
        </div>
      ),
      {
        ...SIZES[format],
        fonts,
        headers: { "Cache-Control": "public, max-age=86400" },
      }
    );
  } catch (err) {
    console.error("[quote] failed", err);
    return new Response("Failed", { status: 500 });
  }
}
