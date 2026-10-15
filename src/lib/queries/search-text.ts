import "server-only";
import { or, sql, type SQL } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";

// Uzbek Latin is written with several look-alike apostrophes — oʻ / o‘ / o' /
// o` (and ʼ ’ ´ for the tutuq belgisi). Titles use whichever the author's
// keyboard produced, while people searching mostly type the plain ' — to the
// database those are different characters, so "qo'shiq" never found
// "qoʻshiq". Both sides are folded to the plain apostrophe before comparing.
const APOSTROPHES = "ʻʼ‘’`´";
const PLAIN = "'".repeat(APOSTROPHES.length);
const APOSTROPHE_RE = /[ʻʼ‘’`´]/g;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function normalizeSearch(q: string): string {
  return q.replace(APOSTROPHE_RE, "'").replace(/\s+/g, " ").trim();
}

// Case-insensitive "contains", apostrophe-insensitive. Null columns never match.
export function textContains(column: AnyColumn | SQL, q: string): SQL {
  const pattern = `%${escapeLike(normalizeSearch(q))}%`;
  return sql`translate(${column}, ${APOSTROPHES}, ${PLAIN}) ilike ${pattern}`;
}

export function anyTextContains(columns: (AnyColumn | SQL)[], q: string): SQL {
  return or(...columns.map((c) => textContains(c, q)))!;
}
