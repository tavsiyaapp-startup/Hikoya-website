import type { SupabaseClient } from "@supabase/supabase-js";

// Upload paths are timestamped (`${Date.now()}-${file.name}`) so a
// replacement upload never reuses the old path — without this, the
// previous file just orphans in Storage forever, counting against the
// project's Storage quota while nothing references it anymore.

export function storagePathFromPublicUrl(bucket: string, url: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

// Best-effort: called after the replacement upload already succeeded, so a
// delete failure (permissions, network, already gone) never blocks the
// user from seeing their new image.
export async function deleteOldStorageFile(
  supabase: SupabaseClient,
  bucket: string,
  oldUrl: string | null | undefined
) {
  if (!oldUrl) return;
  const path = storagePathFromPublicUrl(bucket, oldUrl);
  if (!path) return;
  try {
    await supabase.storage.from(bucket).remove([path]);
  } catch {
    // orphaned file at worst — never surface this to the user
  }
}
