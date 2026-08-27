import { locales, getDictionary, type Locale } from "@/lib/i18n";

// stories.genre is stored as whatever language's label was showing in the
// picker when the author created the story (CreateWizard sets it straight
// from t.genres[i], no canonical/stable id) — so two stories with the same
// real genre can have different stored text depending on the author's
// locale at creation time. Genre lists are kept as parallel same-order
// arrays across dictionaries specifically so this index-based mapping
// works: find which locale's list the stored value came from, then read
// the same index out of the target locale's list.
function genreIndex(genre: string): { locale: Locale; index: number } | null {
  for (const locale of locales) {
    const index = getDictionary(locale).genres.indexOf(genre);
    if (index !== -1) return { locale, index };
  }
  return null;
}

// Display text for a stored genre value in the viewer's current locale.
// Falls back to the raw stored value for anything not found in either
// list (shouldn't happen for genre picker output, but stays safe).
export function localizeGenre(genre: string, locale: Locale): string {
  const found = genreIndex(genre);
  if (!found) return genre;
  return getDictionary(locale).genres[found.index] ?? genre;
}

// Every locale's label for the same genre as the one stored — used to
// match stories by genre regardless of which locale they were created
// under (a genre filter/chip only carries the current locale's text).
export function genreVariants(genre: string): string[] {
  const found = genreIndex(genre);
  if (!found) return [genre];
  return locales.map((locale) => getDictionary(locale).genres[found.index]);
}
