// Shared types + helpers for the local manga/comic prototype (/manga-lab).
// This is a self-contained test bed — it does NOT touch the database or the
// real create/manage/reader flows. Once the UX is approved it gets wired into
// the real story model (a `stories.kind` column + a chapter "pages" model) and
// the existing /uploads + /thumb pipeline.

export type MangaKind = "text" | "manga";

// One comic page = one image. In production `src` is an /uploads URL; in the
// lab it's an object URL (uploaded preview) or an inline SVG data URI (sample).
export type MangaPage = {
  id: string;
  src: string;
  name?: string;
  bytes?: number; // stored size after client resize — drives the memory estimate
  width?: number;
  height?: number;
};

export type ReadingMode = "webtoon" | "paged";
export type ReadingDirection = "ltr" | "rtl";
export type FitMode = "width" | "height";

// --- Storage math -----------------------------------------------------------
// Mirrors server/storage/local.ts: USER_UPLOAD_QUOTA_BYTES = 300 MB per user,
// MAX_UPLOAD_BYTES = 10 MB per file.
export const PER_USER_QUOTA_MB = 300;
export const MAX_FILE_MB = 10;

// On top of each stored original, the reader is served a device-width WebP via
// /thumb, cached on disk. One or two widths per page ≈ +30% over the original.
export const THUMB_CACHE_FACTOR = 1.3;

// Fallback assumption when nothing has been measured yet: a manga page resized
// to ~1400px wide, JPEG q85, is typically ~280 KB.
export const DEFAULT_PAGE_BYTES = 280 * 1024;

// Resize bounds used for uploaded pages — wider than a cover (manga is read at
// full width) but still capped so one page can't be a 6 MB phone photo.
export const PAGE_MAX_WIDTH = 1400;
export const PAGE_MAX_HEIGHT = 2200;
export const PAGE_JPEG_QUALITY = 0.85;

const MB = 1024 * 1024;

export function fmtSize(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(bytes >= 10 * MB ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export type StorageProjection = {
  avgPageBytes: number;
  chapter: (pages: number) => number; // raw stored bytes for N pages
  withThumbs: (bytes: number) => number; // + reader-width WebP cache
  pagesPerUserQuota: number; // how many pages fit the 300 MB quota (incl. thumbs)
};

export function projectStorage(avgPageBytes: number): StorageProjection {
  const safeAvg = Math.max(1, avgPageBytes);
  return {
    avgPageBytes: safeAvg,
    chapter: (pages) => safeAvg * pages,
    withThumbs: (bytes) => bytes * THUMB_CACHE_FACTOR,
    pagesPerUserQuota: Math.floor((PER_USER_QUOTA_MB * MB) / (safeAvg * THUMB_CACHE_FACTOR)),
  };
}

// --- Sample pages -----------------------------------------------------------
// Self-contained inline SVG "manga" pages so the reader can be evaluated with
// zero uploads and fully offline. Aspect ~2:3, numbered, with panel frames.
export function makeSamplePages(count = 8): MangaPage[] {
  const pages: MangaPage[] = [];
  for (let i = 0; i < count; i++) {
    const n = i + 1;
    const svg = samplePageSvg(n, count);
    pages.push({
      id: `sample-${n}`,
      src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
      name: `sahifa-${String(n).padStart(2, "0")}.svg`,
      bytes: DEFAULT_PAGE_BYTES,
      width: 800,
      height: 1200,
    });
  }
  return pages;
}

function samplePageSvg(n: number, total: number): string {
  // Alternate a couple of panel layouts so scrolling/paging feels like a book.
  const paper = n % 2 === 0 ? "#efeae1" : "#f5f2ec";
  const ink = "#1b1a22";
  const accent = "#6d5bd0";
  const panels =
    n % 3 === 0
      ? `<rect x="56" y="150" width="688" height="430" fill="#fff" stroke="${ink}" stroke-width="5"/>
         <rect x="56" y="600" width="330" height="470" fill="#fff" stroke="${ink}" stroke-width="5"/>
         <rect x="414" y="600" width="330" height="470" fill="#fff" stroke="${ink}" stroke-width="5"/>`
      : n % 3 === 1
        ? `<rect x="56" y="150" width="330" height="430" fill="#fff" stroke="${ink}" stroke-width="5"/>
           <rect x="414" y="150" width="330" height="430" fill="#fff" stroke="${ink}" stroke-width="5"/>
           <rect x="56" y="600" width="688" height="470" fill="#fff" stroke="${ink}" stroke-width="5"/>`
        : `<rect x="56" y="150" width="688" height="920" fill="#fff" stroke="${ink}" stroke-width="5"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200">
  <rect width="800" height="1200" fill="${paper}"/>
  <text x="56" y="100" font-family="Georgia, serif" font-size="44" font-weight="700" fill="${ink}">Namuna manga</text>
  <text x="744" y="100" text-anchor="end" font-family="Georgia, serif" font-size="40" fill="${accent}" font-weight="700">${n} / ${total}</text>
  ${panels}
  <circle cx="250" cy="330" r="70" fill="${paper}" stroke="${ink}" stroke-width="4"/>
  <text x="400" y="1150" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="${ink}" opacity="0.6">— sahifa ${n} —</text>
</svg>`;
}
