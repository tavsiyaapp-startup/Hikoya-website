import "server-only";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import sharp from "sharp";

// Replaces Supabase Storage now that the public site's auth moved to Better
// Auth (its browser SDK upload calls relied on a Supabase session that no
// longer exists — see lib/actions/uploads.ts for the full story). Files
// live under <app root>/public/uploads/, next to the public/ folder the
// deploy workflow already uploads — the deploy's FTP step never deletes
// remote files absent locally, and the repo's own public/ never contains an
// uploads/ subfolder (it's gitignored), so this directory is never touched
// by a redeploy once created.
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
const PUBLIC_PREFIX = "/uploads";
const UPLOAD_PATH_PATTERN = /^[a-z-]+\/[A-Za-z0-9-]+\/[0-9]+-[a-z0-9]+\.(jpg|png|gif|webp)$/;

// Mirrors the Supabase Storage bucket names they replace. covers/avatars/
// chapter-images are per-user (ownerId below is the uploader's own id);
// hero-slides/announcements are staff-only and share a single "shared"
// pseudo-owner folder since there's no per-admin ownership to scope them to.
export type UploadBucket = "covers" | "avatars" | "chapter-images" | "hero-slides" | "announcements";

// Uploaded files are served straight from this site's own origin, so the
// file type is decided by the actual bytes, never by the browser-supplied
// filename or Content-Type (both are attacker-controlled). Accepting e.g. an
// "avatar.html" or an SVG with a <script> would turn any upload into stored
// XSS on hikoya.org. Only these raster formats are ever written to disk.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class InvalidUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUploadError";
  }
}

function detectImageExtension(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png";
  if (buf.length >= 6 && (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a")) return ".gif";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return ".webp";
  return null;
}

function validatedExtension(buffer: Buffer): string {
  if (buffer.length === 0) throw new InvalidUploadError("empty file");
  if (buffer.length > MAX_UPLOAD_BYTES) throw new InvalidUploadError("file too large");
  const ext = detectImageExtension(buffer);
  if (!ext) throw new InvalidUploadError("not a supported image (jpeg/png/webp/gif)");
  return ext;
}

function randomSegment(): string {
  return randomBytes(6).toString("hex");
}

// Total bytes one user currently has on disk across the per-user buckets —
// used by lib/actions/uploads.ts and import-docx.ts to cap how much a single
// account can store, so nobody can fill the server's disk with 10 MB files.
export const USER_UPLOAD_QUOTA_BYTES = 300 * 1024 * 1024;

export async function userUploadBytes(ownerId: string): Promise<number> {
  let total = 0;
  for (const bucket of ["covers", "avatars", "chapter-images"] as const) {
    const dir = path.join(UPLOADS_ROOT, bucket, ownerId);
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      continue; // no uploads in this bucket yet
    }
    for (const name of names) {
      try {
        total += (await stat(path.join(dir, name))).size;
      } catch {
        // deleted between readdir and stat
      }
    }
  }
  return total;
}

export function uploadUrlPrefix(bucket: UploadBucket, ownerId: string): string {
  return `${PUBLIC_PREFIX}/${bucket}/${ownerId}/`;
}

async function writeUpload(bucket: UploadBucket, ownerId: string, buffer: Buffer, extension: string): Promise<string> {
  const fileName = `${Date.now()}-${randomSegment()}${extension}`;
  const dir = path.join(UPLOADS_ROOT, bucket, ownerId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), buffer);
  return `${uploadUrlPrefix(bucket, ownerId)}${fileName}`;
}

// ownerId is always a server-trusted id (the signed-in uploader's own uuid,
// or "shared" for the staff-only buckets) — never raw user input — so it
// never needs sanitizing the way the filename does.
export async function saveUpload(bucket: UploadBucket, ownerId: string, file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) throw new InvalidUploadError("file too large");
  const buffer = Buffer.from(await file.arrayBuffer());
  return writeUpload(bucket, ownerId, buffer, validatedExtension(buffer));
}

// For server-side writers that already have raw bytes instead of a browser
// File — import-docx.ts's mammoth image extraction.
// contentType from the .docx is ignored for the same reason — the bytes
// decide. An embedded image in an unsupported format (EMF/WMF/SVG...) throws
// InvalidUploadError and the caller drops it.
export async function saveUploadBuffer(bucket: UploadBucket, ownerId: string, buffer: Buffer): Promise<string> {
  return writeUpload(bucket, ownerId, buffer, validatedExtension(buffer));
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

// For app/uploads/[...path]/route.ts. `next start` only serves public/ files
// that existed when the server started, so anything uploaded since the last
// restart answered 404 until the next one — the route reads the file from
// disk on each request instead. Same strict path check as deleteUpload.
export async function readUpload(relative: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (!UPLOAD_PATH_PATTERN.test(relative)) return null;
  const resolved = path.join(UPLOADS_ROOT, relative);
  if (!resolved.startsWith(UPLOADS_ROOT + path.sep)) return null;
  const contentType = CONTENT_TYPES[relative.slice(relative.lastIndexOf(".") + 1)];
  if (!contentType) return null;
  try {
    return { data: await readFile(resolved), contentType };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") console.error("[uploads] read failed", relative, err);
    return null;
  }
}

// Card-sized thumbnails, made once and cached on disk, so a list of covers
// no longer ships the full 1080px upload for a ~180px card. Allowed widths
// are a fixed set (no arbitrary sizes a caller could use to fill the disk).
// Works for already-uploaded covers too — it resizes on first request. GIFs
// are served whole (animation); everything else becomes WebP.
export const THUMB_WIDTHS = [240, 360, 480, 720, 1080] as const;
const THUMBS_ROOT = path.join(UPLOADS_ROOT, ".thumbs");

export async function readUploadThumb(relative: string, width: number): Promise<{ data: Buffer; contentType: string } | null> {
  if (!UPLOAD_PATH_PATTERN.test(relative)) return null;
  if (!(THUMB_WIDTHS as readonly number[]).includes(width)) return null;
  if (relative.endsWith(".gif")) return null; // keep animation — serve the original

  const cacheFile = path.join(THUMBS_ROOT, String(width), `${relative}.webp`);
  if (!cacheFile.startsWith(THUMBS_ROOT + path.sep)) return null;
  try {
    return { data: await readFile(cacheFile), contentType: "image/webp" };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") console.error("[uploads] thumb read failed", relative, err);
  }

  const original = await readUpload(relative);
  if (!original) return null;
  try {
    const data = await sharp(original.data).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    await mkdir(path.dirname(cacheFile), { recursive: true });
    await writeFile(cacheFile, data);
    return { data, contentType: "image/webp" };
  } catch (err) {
    console.error("[uploads] thumb resize failed", relative, err);
    return original; // fall back to the full image rather than a broken one
  }
}

// Best-effort, same tolerance the old Supabase-backed deleteOldStorageFile
// had: never throws, and a url that isn't one of ours (an old Supabase
// link, or anything else) is left alone rather than treated as an error —
// callers are expected to have already checked bucket/ownership (see
// lib/actions/uploads.ts) before calling this.
export async function deleteUpload(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith(`${PUBLIC_PREFIX}/`)) return;
  const relative = url.slice(PUBLIC_PREFIX.length + 1);
  // Exactly the shape writeUpload produces — <bucket>/<ownerId>/<file> with
  // no "..", slashes or other tricks in any segment. A prefix check alone let
  // "covers/<me>/../../avatars/<someone-else>/x.jpg" through to delete another
  // user's file.
  if (!UPLOAD_PATH_PATTERN.test(relative)) return;
  const resolved = path.join(UPLOADS_ROOT, relative);
  if (!resolved.startsWith(UPLOADS_ROOT + path.sep)) return;
  try {
    await unlink(resolved);
  } catch (err) {
    // orphaned file at worst — never surface this to the caller
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") console.error("[uploads] delete failed", relative, err);
  }
}
