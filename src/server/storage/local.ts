import "server-only";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

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

// Mirrors the Supabase Storage bucket names they replace. covers/avatars/
// chapter-images are per-user (ownerId below is the uploader's own id);
// hero-slides/announcements are staff-only and share a single "shared"
// pseudo-owner folder since there's no per-admin ownership to scope them to.
export type UploadBucket = "covers" | "avatars" | "chapter-images" | "hero-slides" | "announcements";

// Only the extension survives from a browser-supplied filename — nothing
// else about it is trusted enough to become part of a disk path.
function safeExtension(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext ? `.${ext.slice(0, 8)}` : "";
}

function extensionFromContentType(contentType: string): string {
  const ext = contentType.split("/")[1]?.replace(/[^a-z0-9]/gi, "").slice(0, 8);
  return ext ? `.${ext}` : "";
}

function randomSegment(): string {
  return Math.random().toString(36).slice(2, 10);
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
  const buffer = Buffer.from(await file.arrayBuffer());
  return writeUpload(bucket, ownerId, buffer, safeExtension(file.name));
}

// For server-side writers that already have raw bytes instead of a browser
// File — import-docx.ts's mammoth image extraction.
export async function saveUploadBuffer(bucket: UploadBucket, ownerId: string, buffer: Buffer, contentType: string): Promise<string> {
  return writeUpload(bucket, ownerId, buffer, extensionFromContentType(contentType));
}

// Best-effort, same tolerance the old Supabase-backed deleteOldStorageFile
// had: never throws, and a url that isn't one of ours (an old Supabase
// link, or anything else) is left alone rather than treated as an error —
// callers are expected to have already checked bucket/ownership (see
// lib/actions/uploads.ts) before calling this.
export async function deleteUpload(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith(`${PUBLIC_PREFIX}/`)) return;
  const relative = url.slice(PUBLIC_PREFIX.length + 1);
  const resolved = path.join(UPLOADS_ROOT, relative);
  if (!resolved.startsWith(UPLOADS_ROOT)) return;
  try {
    await unlink(resolved);
  } catch {
    // orphaned file at worst — never surface this to the caller
  }
}
