// Covers, avatars and banner images uploaded before the move off Supabase
// still point at *.supabase.co in the database, and that storage no longer
// serves them (402). Treating those urls as "no image" makes every place
// that shows one fall back to its normal empty state — title and author on a
// cover, initials on an avatar — instead of a broken image. The database
// rows are left untouched; a new upload simply replaces the url.
const DEAD_IMAGE_HOST = /^https?:\/\/[^/]+\.supabase\.co\//i;

export function liveImageUrl(url: string | null | undefined): string | null {
  if (!url || DEAD_IMAGE_HOST.test(url)) return null;
  return url;
}
