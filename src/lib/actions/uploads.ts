"use server";

import { headers } from "next/headers";
import { getAuth } from "@/server/auth/config";
import { getStaffSession } from "@/server/auth/staff";
import { saveUpload, deleteUpload, uploadUrlPrefix, InvalidUploadError } from "@/server/storage/local";

type UploadResult = { url: string } | { error: string };

type UserBucket = "covers" | "avatars" | "chapter-images";
type StaffBucket = "hero-slides" | "announcements";

// Server Action arguments come straight from the client — TypeScript types
// are not enforced at runtime, so `bucket` is re-checked against these
// fixed lists. Without it a crafted call could pass "../.." and write
// outside public/uploads, or a regular user could write into a staff bucket.
const USER_BUCKETS: readonly string[] = ["covers", "avatars", "chapter-images"];
const STAFF_BUCKETS: readonly string[] = ["hero-slides", "announcements"];

async function requireViewerId(): Promise<string | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

async function requireStaffId(): Promise<string | null> {
  const result = await getStaffSession();
  return result.status === "staff" ? result.staff.id : null;
}

function extractImageFile(formData: FormData): File | null {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return file;
}

// The real type check happens on the file's bytes inside saveUpload; an
// invalid or oversized file comes back as a normal error result instead of
// a thrown exception.
async function store(bucket: Parameters<typeof saveUpload>[0], ownerId: string, file: File): Promise<UploadResult> {
  try {
    return { url: await saveUpload(bucket, ownerId, file) };
  } catch (err) {
    if (err instanceof InvalidUploadError) return { error: "invalid_file" };
    throw err;
  }
}

// Replaces every form that used to upload straight from the browser to
// Supabase Storage with its own anon-key client. That relied on the
// visitor's Supabase session for the bucket's RLS-style write check — gone
// now that login is Better Auth, so uploads have to go through the server
// instead (this action), which resolves identity from the Better Auth
// session itself rather than trusting anything the client sends.
export async function uploadUserImage(bucket: UserBucket, formData: FormData): Promise<UploadResult> {
  const userId = await requireViewerId();
  if (!userId) return { error: "unauthorized" };
  if (!USER_BUCKETS.includes(bucket)) return { error: "invalid_bucket" };
  const file = extractImageFile(formData);
  if (!file) return { error: "invalid_file" };
  return store(bucket, userId, file);
}

// Scoped to the uploader's own folder (uploadUserImage always saves there) —
// a url pointing anywhere else is silently ignored rather than deleted,
// since these urls are public (rendered straight into `<img src>`) and
// otherwise nothing would stop one user from deleting another's file.
export async function deleteUserImage(bucket: UserBucket, url: string | null | undefined): Promise<void> {
  const userId = await requireViewerId();
  if (!userId || !url || !USER_BUCKETS.includes(bucket) || !url.startsWith(uploadUrlPrefix(bucket, userId))) return;
  await deleteUpload(url);
}

export async function uploadStaffImage(bucket: StaffBucket, formData: FormData): Promise<UploadResult> {
  const staffId = await requireStaffId();
  if (!staffId) return { error: "unauthorized" };
  if (!STAFF_BUCKETS.includes(bucket)) return { error: "invalid_bucket" };
  const file = extractImageFile(formData);
  if (!file) return { error: "invalid_file" };
  return store(bucket, "shared", file);
}

export async function deleteStaffImage(bucket: StaffBucket, url: string | null | undefined): Promise<void> {
  const staffId = await requireStaffId();
  if (!staffId || !url || !STAFF_BUCKETS.includes(bucket) || !url.startsWith(uploadUrlPrefix(bucket, "shared"))) return;
  await deleteUpload(url);
}
