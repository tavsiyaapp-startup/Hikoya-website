// Single-value, optional field on stories.relationship_type — not part of
// the tags/story_tags system that genre/warning/style use. The canonical
// stored value is always the Russian label (tuple[0]), same convention as
// the warning/style tags: only the on-screen text switches with locale, so
// search filtering matches regardless of which locale a story was authored
// or is being browsed in.
export const RELATIONSHIP_TYPES: [string, string][] = [
  ["Друзья → любовь", "Doʻstlikdan sevgiga"],
  ["Второй шанс", "Ikkinchi imkoniyat"],
  ["Соседи", "Qoʻshnilar"],
  ["Без романтики", "Romantikasiz"],
];
